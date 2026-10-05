import json
from pathlib import Path

import httpx

from stash.services.extract import extract, failed_urls, split_urls
from stash.store.sources import read_source

FIX = Path(__file__).parent / "fixtures" / "instagram"
REEL = "https://www.instagram.com/reel/DeCczhMTU9A/?stkn=abc"
CAROUSEL = "https://www.instagram.com/p/Ddy6SMxjlpe/?img_index=9"
GONE = "https://www.instagram.com/p/DeB1kXbjWTe/"


class Fake:
    """Embed fetcher on fixtures + CDN that records every download."""

    def __init__(self, statuses: list[int] | None = None, cdn_403_first: bool = False):
        self.fetches: list[str] = []
        self.downloads: list[str] = []
        self.statuses = statuses or []
        self.cdn_403_first = cdn_403_first

    def fetch(self, kind: str, code: str) -> tuple[int, str]:
        self.fetches.append(code)
        status = self.statuses.pop(0) if self.statuses else 200
        return status, (FIX / f"{code}.html").read_text(encoding="utf-8")

    def client(self) -> httpx.Client:
        def handle(req: httpx.Request) -> httpx.Response:
            if self.cdn_403_first:
                self.cdn_403_first = False
                return httpx.Response(403)
            self.downloads.append(str(req.url))
            return httpx.Response(200, content=b"media")

        return httpx.Client(transport=httpx.MockTransport(handle))


def _run(home: Path, fake: Fake, urls: list[str]):
    return extract(home, urls, fetch=fake.fetch, client=fake.client(), sleep=lambda _: None)


def test_reel_writes_media_raw_and_source(tmp_path: Path) -> None:
    fake = Fake()
    [r] = _run(tmp_path, fake, [REEL])
    assert r["status"] == "fetched"
    assert r["files"] == ["video.mp4", "thumb.jpg"]
    sdir = tmp_path / "library/sources/ig-DeCczhMTU9A"
    assert (sdir / "video.mp4").read_bytes() == b"media"
    raw = json.loads((sdir / "raw.json").read_text(encoding="utf-8"))
    assert raw["record"]["author"] == "thevarunmayya"
    doc = read_source(tmp_path, "ig:DeCczhMTU9A")
    assert (doc.stage, doc.creator, doc.platform) == ("fetched", "thevarunmayya", "instagram")
    assert doc.video == Path("library/sources/ig-DeCczhMTU9A/video.mp4")
    assert doc.caption and "ASD-STE100" in doc.caption
    assert doc.cta is None
    assert not list((tmp_path / "cache").iterdir())  # no leftover .part files


def test_carousel_items_and_cta_hint(tmp_path: Path) -> None:
    [r] = _run(tmp_path, Fake(), [CAROUSEL])
    assert r["files"][:2] == ["item-1.jpg", "item-2.mp4"]
    assert r["files"][-1] == "thumb.jpg" and len(r["files"]) == 10
    doc = read_source(tmp_path, "ig:Ddy6SMxjlpe")
    assert doc.video is None
    assert doc.cta == {"type": "comment", "keyword": "THRONE"}


def test_rerun_is_cached_without_fetch_or_download(tmp_path: Path) -> None:
    _run(tmp_path, Fake(), [REEL])
    fake = Fake()
    [r] = _run(tmp_path, fake, [REEL])
    assert r["status"] == "cached"
    assert fake.fetches == [] and fake.downloads == []


def test_killed_mid_item_resumes_without_redownloading(tmp_path: Path) -> None:
    sdir = tmp_path / "library/sources/ig-DeCczhMTU9A"
    sdir.mkdir(parents=True)
    (sdir / "video.mp4").write_bytes(b"already here")  # died before thumb + source.md
    fake = Fake()
    [r] = _run(tmp_path, fake, [REEL])
    assert r["status"] == "fetched"
    assert len(fake.downloads) == 1  # thumb only
    assert (sdir / "video.mp4").read_bytes() == b"already here"


def test_expired_url_refetches_embed_once(tmp_path: Path) -> None:
    fake = Fake(cdn_403_first=True)
    [r] = _run(tmp_path, fake, [REEL])
    assert r["status"] == "fetched"
    assert fake.fetches == ["DeCczhMTU9A", "DeCczhMTU9A"]


def test_unavailable_post_logged_and_retryable(tmp_path: Path) -> None:
    [r] = _run(tmp_path, Fake(), [GONE])
    assert r["status"] == "failed" and r["reason"] == "blocked:unavailable"
    assert failed_urls(tmp_path) == [GONE]


def test_rate_limit_stops_batch_and_queues_rest(tmp_path: Path) -> None:
    fake = Fake(statuses=[429])
    results = _run(tmp_path, fake, [REEL, CAROUSEL])
    assert [r["status"] for r in results] == ["queued", "queued"]
    assert fake.fetches == ["DeCczhMTU9A"]
    assert failed_urls(tmp_path) == []


def test_invalid_glued_and_duplicate_links(tmp_path: Path) -> None:
    glued = REEL + "https://www.instagram.com/reel/DeCczhMTU9A/ https://example.com/x"
    results = _run(tmp_path, Fake(), [glued])
    assert [r["status"] for r in results] == ["invalid", "fetched"]


def test_split_urls() -> None:
    assert split_urls(["a https://x/1https://x/2", "https://x/3"]) == [
        "a",
        "https://x/1",
        "https://x/2",
        "https://x/3",
    ]
