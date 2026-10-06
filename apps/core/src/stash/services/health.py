"""Live reachability probe for `stash check --live`.

Answers "is this link alive and maintained", not "is it any good": pricing and value
are judged by the agent. Anti-bot walls are reported as `blocked` (unknown), never dead.
"""

from datetime import UTC, datetime
from typing import Literal
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, Field

from stash.errors import StashError

STALE_DAYS = 365
TIMEOUT = 15.0
_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)
# Bot walls and rate limits: the page may be fine, we just cannot see it.
_BLOCKED_CODES = (401, 403, 429, 503)
_DEAD_CODES = (404, 410, 451)
_PARKED_MARKERS = (
    "this domain is for sale",
    "this domain may be for sale",
    "buy this domain",
    "domain is parked",
    "parked free, courtesy of",
)
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "lnkd.in", "rb.gy", "shorturl.at", "cutt.ly")
_HUBS = ("linktr.ee", "beacons.ai", "bio.link", "lnk.bio", "stan.store", "taplink.cc")

Status = Literal["live", "dead", "blocked", "error"]


class Health(BaseModel):
    status: Status
    http_status: int | None = None
    final_url: str | None = None
    # Machine-readable reasons the agent should surface in the review table.
    flags: list[str] = Field(default_factory=list[str])
    note: str | None = None
    # GitHub only.
    archived: bool | None = None
    license: str | None = None
    stars: int | None = None
    pushed_at: str | None = None
    canonical_key: str | None = None


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").removeprefix("www.").lower()


def _days_since(iso: str) -> int | None:
    try:
        then = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None
    return (datetime.now(UTC) - then).days


def _url_flags(url: str, final_url: str) -> list[str]:
    flags: list[str] = []
    start, end = _host(url), _host(final_url)
    if start in _SHORTENERS:
        flags.append("shortener")
    if end in _HUBS:
        flags.append("link_hub")  # a link-in-bio page: the real tools are one click deeper
    if start and end and start != end and start not in _SHORTENERS:
        flags.append("redirected_domain")  # acquired, rebranded, or hijacked
    return flags


def _probe_github(url: str) -> Health:
    from stash.extract.github import extract_github

    try:
        _, rec = extract_github(url)
    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        status: Status = "dead" if code in _DEAD_CODES else "error"
        return Health(status=status, http_status=code, note=f"GitHub returned {code}")
    except StashError as e:
        code = e.details.get("status")
        if isinstance(code, int) and code in _DEAD_CODES:
            return Health(status="dead", http_status=code, note="repo deleted, private or renamed")
        return Health(status="error", note=e.message)
    except httpx.HTTPError as e:
        return Health(status="error", note=str(e))

    flags: list[str] = []
    if rec.archived:
        flags.append("archived")
    if not rec.license or rec.license.upper() in ("NOASSERTION", "OTHER"):
        flags.append("no_license")  # all rights reserved by default
    days = _days_since(rec.pushed_at) if rec.pushed_at else None
    if days is not None and days > STALE_DAYS:
        flags.append("stale")
    parsed = urlparse(url).path.strip("/").split("/")
    if len(parsed) >= 2 and rec.canonical_key.lower() != f"github:{parsed[0]}/{parsed[1]}".lower():
        flags.append("renamed")
    return Health(
        status="live",
        http_status=200,
        final_url=rec.url,
        flags=flags,
        archived=rec.archived,
        license=rec.license,
        stars=rec.stars,
        pushed_at=rec.pushed_at,
        canonical_key=rec.canonical_key,
    )


def probe(url: str, *, client: httpx.Client | None = None) -> Health:
    """One GET with redirects followed. GitHub repos go through the GitHub extractor."""
    if _host(url) == "github.com" and len(urlparse(url).path.strip("/").split("/")) >= 2:
        return _probe_github(url)

    own = client is None
    http = client or httpx.Client(timeout=TIMEOUT, follow_redirects=True)
    try:
        resp = http.get(url, headers={"User-Agent": _UA})
    except (httpx.ConnectError, httpx.UnsupportedProtocol) as e:
        # DNS failure or refused connection: the domain is gone.
        return Health(status="dead", flags=_url_flags(url, url), note=str(e) or "connect failed")
    except httpx.HTTPError as e:
        return Health(status="error", note=str(e) or type(e).__name__)
    finally:
        if own:
            http.close()

    code = resp.status_code
    final_url = str(resp.url)
    flags = _url_flags(url, final_url)
    body = resp.text[:20000].lower() if code < 400 else ""
    if any(m in body for m in _PARKED_MARKERS):
        flags.append("parked_domain")
        return Health(status="dead", http_status=code, final_url=final_url, flags=flags)
    if code in _DEAD_CODES:
        status: Status = "dead"
    elif code in _BLOCKED_CODES:
        status = "blocked"
    elif code >= 400:
        status = "error"
    else:
        status = "live"
    return Health(status=status, http_status=code, final_url=final_url, flags=flags)
