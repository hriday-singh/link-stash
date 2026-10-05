"""Generic web page extractor for blogs, documentation, articles, and websites."""

import re
from datetime import UTC, datetime
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, Field

from stash.errors import Invalid
from stash.extract.fetch import fetch_page_text
from stash.extract.hf import extract_mentions_from_text
from stash.extract.notion import normalize_url_key
from stash.store.models import Mention, SourceDoc


class WebRecord(BaseModel):
    """Normalized structured data extracted from a generic web page."""

    url: str
    canonical_key: str
    title: str
    description: str | None = None
    text: str = ""
    outbound_links: list[str] = Field(default_factory=list)
    mentions: list[Mention] = Field(default_factory=list[Mention])


def extract_web_content(html: str, url: str) -> WebRecord:
    """Extract page title, meta description, readable text, and links."""
    # Title extraction
    title = urlparse(url).netloc
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    if title_match:
        title = title_match.group(1).strip()

    # Meta description
    description: str | None = None
    desc_match = re.search(
        r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']',
        html,
        re.IGNORECASE,
    )
    if not desc_match:
        desc_match = re.search(
            r'<meta\s+property=["\']og:description["\']\s+content=["\'](.*?)["\']',
            html,
            re.IGNORECASE,
        )
    if desc_match:
        description = desc_match.group(1).strip()

    # Outbound links
    host = urlparse(url).netloc.lower()
    outbound = list(
        dict.fromkeys(
            m.group(0)
            for m in re.finditer(r"https?://[^\s\"'<>\)]+", html)
            if host not in m.group(0).lower()
        )
    )

    mentions = extract_mentions_from_text(html)
    canonical_key = normalize_url_key(url)

    # Clean stripped text
    clean_text = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    clean_text = re.sub(
        r"<style[^>]*>.*?</style>", " ", clean_text, flags=re.IGNORECASE | re.DOTALL
    )
    clean_text = re.sub(r"<[^>]+>", " ", clean_text)
    clean_text = re.sub(r"\s+", " ", clean_text).strip()

    return WebRecord(
        url=url,
        canonical_key=canonical_key,
        title=title,
        description=description,
        text=clean_text[:6000],
        outbound_links=outbound,
        mentions=mentions,
    )


def extract_web(
    url: str,
    *,
    client: httpx.Client | None = None,
    html: str | None = None,
) -> tuple[SourceDoc, WebRecord]:
    """Extract generic web content."""
    clean_url = url.strip()
    if not clean_url.startswith(("http://", "https://")):
        raise Invalid(f"Invalid web URL: {url}", {"url": url})

    if html is None:
        _, html = fetch_page_text(clean_url, client=client)

    rec = extract_web_content(html, clean_url)
    source_doc = SourceDoc(
        key=rec.canonical_key,
        platform="web",
        creator=urlparse(clean_url).netloc,
        url=clean_url,
        stage="fetched",
        fetched_at=datetime.now(UTC),
        caption=rec.description or (rec.text[:300] if rec.text else None),
        summary=f"Web: {rec.title}",
        mentions=rec.mentions,
    )
    return source_doc, rec
