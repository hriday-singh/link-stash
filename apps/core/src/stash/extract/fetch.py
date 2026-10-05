"""Universal web fetching using Scrapling (Fetcher + StealthyFetcher fallback)."""

from typing import Any

import httpx

# Cloudflare and anti-bot challenge signatures
_CHALLENGE_INDICATORS = (
    "cf-turnstile",
    "challenge-running",
    "cf-browser-verification",
    "just a moment...",
    "attention required! | cloudflare",
    "security check to continue",
    "enable javascript and cookies to continue",
)


def is_challenge_page(status: int, text: str) -> bool:
    """Check if a response is an anti-bot challenge or blocked page."""
    if status in (401, 403, 429, 503):
        return True
    lower = text.lower()
    return any(ind in lower for ind in _CHALLENGE_INDICATORS)


def fetch_page_text(
    url: str,
    *,
    client: httpx.Client | None = None,
    timeout: float = 30.0,
    stealth: bool = False,
    headers: dict[str, str] | None = None,
) -> tuple[int, str]:
    """Fetch URL text using Scrapling Fetcher with automatic StealthyFetcher escalation.

    If a client is explicitly provided (e.g., test mocks), routes through the client.
    Returns (status_code, html_or_text).
    """
    if client is not None:
        resp = client.get(url, headers=headers)
        return resp.status_code, resp.text

    from scrapling.fetchers import Fetcher, StealthyFetcher

    if not stealth:
        try:
            get_kwargs: dict[str, Any] = {
                "timeout": timeout,
                "follow_redirects": True,
                "stealthy_headers": True,
                "retries": 1,
            }
            if headers:
                get_kwargs["headers"] = headers
            resp = Fetcher.get(url, **get_kwargs)
            html = resp.body.decode("utf-8", "replace")
            status = resp.status
            if not is_challenge_page(status, html):
                return status, html
        except Exception:
            # Fall back to stealthy fetcher on network, challenge or parsing error
            pass

    # StealthyFetcher escalation with real Chrome fingerprinting
    page = StealthyFetcher.fetch(
        url,
        disable_resources=True,
        timeout=int(timeout * 1000),
        real_chrome=True,
    )
    return page.status, page.body.decode("utf-8", "replace")


def fetch_page_bytes(
    url: str,
    *,
    client: httpx.Client | None = None,
    timeout: float = 45.0,
    headers: dict[str, str] | None = None,
) -> bytes:
    """Download binary data (e.g. PDF) using Scrapling Fetcher."""
    if client is not None:
        resp = client.get(url, headers=headers)
        resp.raise_for_status()
        return resp.content

    from scrapling.fetchers import Fetcher

    get_kwargs: dict[str, Any] = {
        "timeout": timeout,
        "follow_redirects": True,
        "stealthy_headers": True,
        "retries": 2,
    }
    if headers:
        get_kwargs["headers"] = headers
    resp = Fetcher.get(url, **get_kwargs)
    if resp.status >= 400:
        raise httpx.HTTPStatusError(
            f"Fetcher returned status {resp.status}",
            request=httpx.Request("GET", url),
            response=httpx.Response(resp.status, content=resp.body),
        )
    return resp.body
