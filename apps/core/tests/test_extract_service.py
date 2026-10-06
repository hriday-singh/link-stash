import json
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest
from yt_dlp.utils import DownloadError

from stash.errors import Blocked
from stash.extract.ytdlp import BurnerFlagged, YtdlpRecord, fetch_with_cookies
from stash.services.extract import (
    Burner,
    cookies_path,
    default_burner,
    extract,
    failed_urls,
    flag_path,
    split_urls,
)
from stash.services.pending import list_pending
from stash.store.keys import source_dir
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


# A9: blocked embed -> manual mp4 -> burner cookies (yt-dlp) -> pending item.

KEY = "ig:DeB1kXbjWTe"


def _burner_ok(url: str, dest: Path) -> YtdlpRecord:
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "video.mp4").write_bytes(b"mp4")
    return YtdlpRecord(author="dev", caption="Comment GUIDE for the link", files=["video.mp4"])


def _burner_flagged(url: str, dest: Path) -> YtdlpRecord:
    raise BurnerFlagged("feedback_required")


def _extract(home: Path, burner: Burner) -> dict[str, object]:
    fake = Fake()
    [r] = extract(
        home, [GONE], fetch=fake.fetch, client=fake.client(), sleep=lambda _: None, burner=burner
    )
    return r


def test_blocked_embed_uses_burner(tmp_path: Path) -> None:
    r = _extract(tmp_path, _burner_ok)
    assert r["status"] == "fetched" and r["via"] == "burner"
    doc = read_source(tmp_path, KEY)
    assert doc.caption == "Comment GUIDE for the link"
    assert doc.cta == {"type": "comment", "keyword": "GUIDE"}
    assert list_pending(tmp_path) == []


def test_flagged_burner_disables_cookies_and_adds_pending(tmp_path: Path) -> None:
    cookies_path(tmp_path).parent.mkdir(parents=True)
    cookies_path(tmp_path).write_text("# Netscape HTTP Cookie File\n", "utf-8")
    assert default_burner(tmp_path) is not None

    r = _extract(tmp_path, _burner_flagged)
    assert r["status"] == "failed" and r["reason"] == "blocked:burner_flagged"
    assert flag_path(tmp_path).is_file()
    assert default_burner(tmp_path) is None
    [p] = list_pending(tmp_path)
    assert p.kind == "blocked" and p.source_key == KEY


def test_no_burner_adds_one_pending_across_reruns(tmp_path: Path) -> None:
    for _ in range(2):
        r = _run(tmp_path, Fake(), [GONE])[0]
        assert r["status"] == "failed"
    [p] = list_pending(tmp_path)
    assert "video.mp4" in p.instruction


def test_manual_mp4_is_used_when_blocked(tmp_path: Path) -> None:
    sdir = source_dir(tmp_path, KEY)
    sdir.mkdir(parents=True)
    (sdir / "video.mp4").write_bytes(b"mp4")
    r = _run(tmp_path, Fake(), [GONE])[0]
    assert r["status"] == "fetched" and r["via"] == "manual"
    assert read_source(tmp_path, KEY).video is not None


def test_default_burner_needs_cookies(tmp_path: Path) -> None:
    assert default_burner(tmp_path) is None


@pytest.mark.parametrize(
    ("message", "error"),
    [("ERROR: feedback_required", BurnerFlagged), ("ERROR: login required", Blocked)],
)
def test_ytdlp_errors_map_to_blocked(tmp_path: Path, message: str, error: type[Blocked]) -> None:
    with patch("stash.extract.ytdlp.YoutubeDL") as ydl:
        ydl.return_value.__enter__.return_value.extract_info.side_effect = DownloadError(message)
        with pytest.raises(error):
            fetch_with_cookies("https://www.instagram.com/reel/X/", tmp_path, tmp_path / "c.txt")
