"""Notion public page extractor."""

import re
from datetime import UTC, datetime
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, Field

from stash.errors import Invalid
from stash.extract.fetch import fetch_page_text
from stash.extract.hf import extract_mentions_from_text
from stash.store.models import Mention, SourceDoc

NOTION_HOST_RE = re.compile(r"^(?:[\w\-]+\.)?notion\.(?:site|so)$", re.IGNORECASE)


class NotionRecord(BaseModel):
    """Normalized structured data extracted from a Notion page."""

    url: str
    canonical_key: str
    title: str
    text: str = ""
    outbound_links: list[str] = Field(default_factory=list)
    mentions: list[Mention] = Field(default_factory=list[Mention])


def is_notion_url(url: str) -> bool:
    """Check whether a URL belongs to a Notion site."""
    try:
        parsed = urlparse(url.strip())
        return bool(NOTION_HOST_RE.match(parsed.netloc))
    except Exception:
        return False


def normalize_url_key(url: str) -> str:
    """Canonical url key: url:<host><path> without www, query or fragment."""
    parsed = urlparse(url.strip())
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path.rstrip("/")
    return f"url:{host}{path}"


def extract_notion_content(html_or_text: str, url: str) -> NotionRecord:
    """Parse text and outbound links from Notion page content."""
    # Find page title from <title> if present
    title = "Notion Page"
    title_match = re.search(r"<title>(.*?)</title>", html_or_text, re.IGNORECASE | re.DOTALL)
    if title_match:
        raw_title = title_match.group(1).strip()
        # Strip " | Notion" suffix if present
        title = re.sub(r"\s*\|\s*Notion\s*$", "", raw_title, flags=re.IGNORECASE)

    # Outbound links
    outbound = list(
        dict.fromkeys(
            m.group(0)
            for m in re.finditer(r"https?://[^\s\"'<>\)]+", html_or_text)
            if not is_notion_url(m.group(0))
        )
    )

    mentions = extract_mentions_from_text(html_or_text)
    canonical_key = normalize_url_key(url)

    # Clean stripped text preview
    clean_text = re.sub(r"<[^>]+>", " ", html_or_text)
    clean_text = re.sub(r"\s+", " ", clean_text).strip()

    return NotionRecord(
        url=url,
        canonical_key=canonical_key,
        title=title,
        text=clean_text[:16000],
        outbound_links=outbound,
        mentions=mentions,
    )


def extract_notion(
    url: str,
    *,
    client: httpx.Client | None = None,
    html: str | None = None,
) -> tuple[SourceDoc, NotionRecord]:
    """Extract a public Notion page."""
    if not is_notion_url(url):
        raise Invalid(f"Not a Notion URL: {url}", {"url": url})

    if html is None:
        _, html = fetch_page_text(url, client=client, stealth=True)

    rec = extract_notion_content(html, url)
    source_doc = SourceDoc(
        key=rec.canonical_key,
        platform="notion",
        creator=None,
        url=url,
        stage="fetched",
        fetched_at=datetime.now(UTC),
        caption=rec.text[:300] if rec.text else None,
        summary=f"Notion: {rec.title}",
        mentions=rec.mentions,
    )
    return source_doc, rec
