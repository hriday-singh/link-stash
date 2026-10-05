"""Instagram embed page -> record. Pure parsing: no network, so it runs on recorded fixtures."""

import json
import re
from datetime import UTC, datetime
from typing import Any, Literal, cast
from urllib.parse import parse_qs, urlparse

from pydantic import BaseModel

from stash.errors import Blocked

# The embed page ships the post as a JSON string inside a JSON blob: "contextJSON":"{...}".
_CONTEXT = re.compile(r'"contextJSON":("(?:[^"\\]|\\.)*")')
_UNAVAILABLE = "may be broken, or the post may have been removed"

# "Comment “SEND”", «THRONE», 'REPOS', or a bare ALL-CAPS word: "comment JEV and follow".
# ponytail: spec also wants DM/link/send nearby; real captions often skip it ("for my guide").
_Q = "\"'`\u201c\u201d\u2018\u2019\u00ab\u00bb"  # straight, curly and guillemet quotes
_CTA = re.compile(
    r"(?i:\b(?:comment|type|drop|reply)\b)(?:\s+(?i:below|with|the\s+word))?\s*[:\-]?\s*"
    rf"(?:[{_Q}]\s*([\w-]{{2,30}})\s*[{_Q}]|\b([A-Z0-9][A-Z0-9_-]{{1,29}})\b)"
)


class IgMedia(BaseModel):
    type: Literal["video", "image"]
    url: str
    poster: str | None = None


class IgRecord(BaseModel):
    key: str
    shortcode: str
    kind: Literal["reel", "p"]
    url: str
    author: str | None
    caption: str
    comment_count: int
    poster: str | None
    media: list[IgMedia]
    expires_at: datetime | None
    cta_keyword: str | None


def detect_cta(text: str) -> str | None:
    m = _CTA.search(text)
    return (m.group(1) or m.group(2)) if m else None


def url_expiry(url: str) -> datetime | None:
    """Instagram CDN URLs carry `oe=<hex epoch>`; past it the URL returns 403."""
    oe = parse_qs(urlparse(url).query).get("oe")
    try:
        return datetime.fromtimestamp(int(oe[0], 16), UTC) if oe else None
    except ValueError:
        return None


def _media(node: dict[str, Any]) -> IgMedia:
    if node.get("is_video") and node.get("video_url"):
        return IgMedia(type="video", url=node["video_url"], poster=node.get("display_url"))
    return IgMedia(type="image", url=node["display_url"])


def parse_embed(html: str, kind: Literal["reel", "p"], shortcode: str) -> IgRecord:
    """Raise `Blocked` when the page has no post data (removed, embeds off, login wall)."""
    m = _CONTEXT.search(html)
    if not m:
        reason = "unavailable" if _UNAVAILABLE in html else "no_data"
        raise Blocked(
            f"embed page has no post data ({reason})", {"shortcode": shortcode, "reason": reason}
        )
    ctx = cast(dict[str, Any], json.loads(json.loads(m.group(1))))
    gql = cast(dict[str, Any], ctx.get("gql_data") or {})
    sm = cast(dict[str, Any] | None, gql.get("shortcode_media"))
    if not sm:
        raise Blocked(
            "embed page has no post data (no_data)", {"shortcode": shortcode, "reason": "no_data"}
        )

    edges = sm.get("edge_media_to_caption", {}).get("edges", [])
    caption = edges[0]["node"]["text"] if edges else ""
    kids = [e["node"] for e in sm.get("edge_sidecar_to_children", {}).get("edges", [])]
    media = [_media(n) for n in kids] or [_media(sm)]
    expiries = [e for e in (url_expiry(x.url) for x in media) if e]

    return IgRecord(
        key=f"ig:{shortcode}",
        shortcode=shortcode,
        kind=kind,
        url=f"https://www.instagram.com/{kind}/{shortcode}/",
        author=cast(dict[str, Any], sm.get("owner") or {}).get("username"),
        caption=caption,
        comment_count=sm.get("edge_media_to_comment", {}).get("count", 0),
        poster=sm.get("display_url"),
        media=media,
        expires_at=min(expiries) if expiries else None,
        cta_keyword=detect_cta(caption),
    )
