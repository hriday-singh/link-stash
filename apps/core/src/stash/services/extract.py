"""`stash extract`: Instagram links -> source folders with media, resumable, failures logged."""

import json
import os
import random
import re
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

import httpx

from stash.errors import Blocked, StashError
from stash.extract.instagram import IgRecord, parse_embed
from stash.store.keys import parse_ig_url, source_dir
from stash.store.models import SourceDoc
from stash.store.sources import append_failed, write_source

BATCH = 6
Kind = Literal["reel", "p"]
Fetch = Callable[[Kind, str], tuple[int, str]]


class RateLimited(Exception):
    pass


def fetch_embed(kind: Kind, code: str) -> tuple[int, str]:
    """Return (status, html) of the captioned embed page. No login."""
    from scrapling.fetchers import StealthyFetcher  # heavy import, only when fetching

    url = f"https://www.instagram.com/{kind}/{code}/embed/captioned/"
    # ponytail: real_chrome uses installed Chrome; patchright's bundled build needs a big download.
    page = StealthyFetcher.fetch(url, disable_resources=True, timeout=45000, real_chrome=True)
    return page.status, page.body.decode("utf-8", "replace")


def split_urls(args: list[str]) -> list[str]:
    """Pasted text may glue links together ("...NjFxhttps://..."); split on every scheme."""
    return [u for a in args for u in re.split(r"\s+|(?=https?://)", a) if u]


def _files(rec: IgRecord) -> list[tuple[str, str]]:
    """(filename, url) for every media file plus the thumbnail."""
    if len(rec.media) == 1 and rec.media[0].type == "video":
        out = [("video.mp4", rec.media[0].url)]
    else:
        out = [
            (f"item-{i}.{'mp4' if m.type == 'video' else 'jpg'}", m.url)
            for i, m in enumerate(rec.media, 1)
        ]
    if rec.poster:
        out.append(("thumb.jpg", rec.poster))
    return out


def _done(sdir: Path) -> bool:
    raw = sdir / "raw.json"
    if not ((sdir / "source.md").is_file() and raw.is_file()):
        return False
    files: list[str] = json.loads(raw.read_text(encoding="utf-8")).get("files", [])
    return all((sdir / f).is_file() for f in files)


def _download(client: httpx.Client, url: str, dest: Path, tmp_dir: Path) -> None:
    """Stream into cache/, rename into place only when complete."""
    if dest.is_file():
        return
    tmp = tmp_dir / f"{dest.parent.name}-{dest.name}.part"
    with client.stream("GET", url) as r:
        r.raise_for_status()
        with tmp.open("wb") as f:
            for chunk in r.iter_bytes():
                f.write(chunk)
    os.replace(tmp, dest)


def _fetch_record(fetch: Fetch, kind: Kind, code: str) -> IgRecord:
    status, html = fetch(kind, code)
    if status == 429:
        raise RateLimited
    if status != 200:
        raise Blocked(
            f"embed page returned {status}", {"shortcode": code, "reason": f"http_{status}"}
        )
    return parse_embed(html, kind, code)


def _extract_one(
    home: Path, client: httpx.Client, fetch: Fetch, kind: Kind, code: str
) -> dict[str, Any]:
    key = f"ig:{code}"
    sdir = source_dir(home, key)
    rec = _fetch_record(fetch, kind, code)
    sdir.mkdir(parents=True, exist_ok=True)
    tmp_dir = home / "cache"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    for attempt in (1, 2):
        files = _files(rec)
        try:
            for name, url in files:
                _download(client, url, sdir / name, tmp_dir)
            break
        except httpx.HTTPStatusError as e:
            # Signed CDN URLs expire (`oe`); a fresh embed page gives fresh URLs. Once.
            if e.response.status_code != 403 or attempt == 2:
                raise
            rec = _fetch_record(fetch, kind, code)

    names = [n for n, _ in files]
    raw = {"extractor": "instagram", "files": names, "record": rec.model_dump(mode="json")}
    (sdir / "raw.json").write_text(json.dumps(raw, indent=2, ensure_ascii=False), "utf-8")
    rel = sdir.relative_to(home)
    write_source(
        home,
        SourceDoc(
            key=key,
            platform="instagram",
            creator=rec.author,
            url=rec.url,
            stage="fetched",
            fetched_at=datetime.now(UTC),
            caption=rec.caption,
            # Hint only: pending happens in triage, and only if analysis finds nothing concrete.
            cta={"type": "comment", "keyword": rec.cta_keyword} if rec.cta_keyword else None,
            video=rel / "video.mp4" if "video.mp4" in names else None,
            thumb=rel / "thumb.jpg" if "thumb.jpg" in names else None,
        ),
    )
    return {
        "key": key,
        "status": "fetched",
        "dir": str(sdir),
        "files": names,
        "cta_keyword": rec.cta_keyword,
        "expires_at": rec.expires_at,
    }


def failed_urls(home: Path) -> list[str]:
    log = home / "logs" / "failed.jsonl"
    if not log.is_file():
        return []
    lines = log.read_text(encoding="utf-8").splitlines()
    return list(dict.fromkeys(json.loads(x)["url"] for x in lines if x.strip()))


def extract(
    home: Path,
    urls: list[str],
    *,
    fetch: Fetch = fetch_embed,
    client: httpx.Client | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> list[dict[str, Any]]:
    """One result per link: invalid ones first, then unique links in input order.

    Never raises for a single bad link; failures go to logs/failed.jsonl.
    """
    results: list[dict[str, Any]] = []
    todo: dict[str, tuple[Kind, str, str]] = {}
    for url in split_urls(urls):
        try:
            kind, code = parse_ig_url(url)
        except StashError as e:
            results.append({"url": url, "status": "invalid", "error": e.to_dict()["error"]})
            continue
        todo.setdefault(code, (kind, code, url))

    own_client = client is None
    http = client or httpx.Client(
        timeout=60, follow_redirects=True, transport=httpx.HTTPTransport(retries=2)
    )
    fetched = 0
    stopped = False
    try:
        for kind, code, url in todo.values():
            key = f"ig:{code}"
            if stopped:
                results.append({"key": key, "status": "queued", "url": url})
                continue
            if _done(source_dir(home, key)):
                results.append({"key": key, "status": "cached", "dir": str(source_dir(home, key))})
                continue
            if fetched:
                # ponytail: one browser launch per link; StealthySession per batch if this is slow.
                sleep(random.uniform(10, 20) if fetched % BATCH == 0 else random.uniform(2, 5))
            fetched += 1
            try:
                results.append(_extract_one(home, http, fetch, kind, code))
            except RateLimited:
                stopped = True
                results.append(
                    {"key": key, "status": "queued", "url": url, "reason": "rate_limited"}
                )
            except (StashError, httpx.HTTPError, OSError) as e:
                reason = (
                    e.details.get("reason", e.code)
                    if isinstance(e, StashError)
                    else type(e).__name__
                )
                entry = {
                    "key": key,
                    "url": url,
                    "reason": f"blocked:{reason}",
                    "error": str(e),
                    "at": datetime.now(UTC).isoformat(),
                }
                append_failed(home, entry)
                results.append({"key": key, "status": "failed", **entry})
    finally:
        if own_client:
            http.close()
    return results
