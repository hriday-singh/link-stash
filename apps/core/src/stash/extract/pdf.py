"""PDF document extractor for local files or downloaded URLs."""

import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, Field

from stash.errors import Invalid
from stash.extract.fetch import fetch_page_bytes
from stash.extract.hf import extract_mentions_from_text
from stash.extract.notion import normalize_url_key
from stash.store.models import Mention, SourceDoc


class PdfRecord(BaseModel):
    """Normalized structured data extracted from a PDF."""

    source_path_or_url: str
    canonical_key: str
    title: str
    page_count: int = 0
    text: str = ""
    outbound_links: list[str] = Field(default_factory=list)
    mentions: list[Mention] = Field(default_factory=list[Mention])


def extract_pdf_data(data: bytes, source_identifier: str) -> PdfRecord:
    """Parse text and embedded links from raw PDF bytes."""
    title = Path(urlparse(source_identifier).path or source_identifier).stem
    text_chunks: list[str] = []
    links: list[str] = []
    page_count = 0

    try:
        import fitz  # pyright: ignore[reportMissingTypeStubs]

        doc: Any = fitz.open(stream=data, filetype="pdf")
        page_count = len(doc)
        meta: dict[str, Any] = getattr(doc, "metadata", {}) or {}
        if meta.get("title"):
            title = str(meta["title"])

        for page in doc:
            txt: Any = page.get_text()
            if isinstance(txt, str):
                text_chunks.append(txt)
            raw_links = cast(list[dict[str, Any]], page.get_links() or [])
            for link in raw_links:
                uri = link.get("uri")
                if isinstance(uri, str) and uri.startswith(("http://", "https://")):
                    links.append(uri)
    except ImportError, Exception:
        # Fallback raw ASCII text extraction if PyMuPDF unavailable or stream is malformed
        matches = re.findall(rb"\(([\w\s.,;:!?'\"/\\-]{4,})\)", data)
        text_chunks = [m.decode("utf-8", "ignore") for m in matches]
        raw_links = re.findall(rb"https?://[^\s\"'<>\)]+", data)
        links = [link.decode("utf-8", "ignore") for link in raw_links]
        page_count = 1

    full_text = "\n".join(text_chunks)
    mentions = extract_mentions_from_text(full_text)
    outbound = list(dict.fromkeys(links))

    canonical_key = (
        normalize_url_key(source_identifier)
        if source_identifier.startswith(("http://", "https://"))
        else f"pdf:{Path(source_identifier).stem.lower()}"
    )

    return PdfRecord(
        source_path_or_url=source_identifier,
        canonical_key=canonical_key,
        title=title,
        page_count=page_count,
        text=full_text[:24000],
        outbound_links=outbound,
        mentions=mentions,
    )


def extract_pdf(
    path_or_url: str,
    *,
    client: httpx.Client | None = None,
) -> tuple[SourceDoc, PdfRecord]:
    """Extract a PDF from a URL or local file path."""
    source_str = path_or_url.strip()
    data: bytes

    if source_str.startswith(("http://", "https://")):
        data = fetch_page_bytes(source_str, client=client)
    else:
        path = Path(source_str)
        if not path.is_file():
            raise Invalid(f"PDF file does not exist: {path}", {"path": source_str})
        data = path.read_bytes()

    rec = extract_pdf_data(data, source_str)
    source_doc = SourceDoc(
        key=rec.canonical_key,
        platform="pdf",
        creator=None,
        url=source_str
        if source_str.startswith(("http://", "https://"))
        else f"file://{Path(source_str).resolve()}",
        stage="fetched",
        fetched_at=datetime.now(UTC),
        caption=rec.text[:300] if rec.text else None,
        summary=f"PDF ({rec.page_count} pages): {rec.title}",
        mentions=rec.mentions,
    )
    return source_doc, rec
