"""Unit tests for universal Scrapling fetch layer and extractor integration."""

from typing import Any
from unittest.mock import MagicMock, patch

from stash.extract.fetch import fetch_page_bytes, fetch_page_text, is_challenge_page
from stash.extract.github import extract_github_scrape
from stash.extract.hf import extract_hf_scrape
from stash.extract.notion import extract_notion
from stash.extract.pdf import extract_pdf
from stash.extract.web import extract_web


def test_is_challenge_page() -> None:
    assert is_challenge_page(403, "Forbidden") is True
    assert is_challenge_page(429, "Too Many Requests") is True
    assert is_challenge_page(503, "Service Unavailable") is True
    assert is_challenge_page(200, "Just a moment... cf-turnstile") is True
    assert is_challenge_page(200, "<html><div id='challenge-running'></div></html>") is True
    assert is_challenge_page(200, "<html><body><h1>Hello World</h1></body></html>") is False


def test_fetch_page_text_fetcher_success() -> None:
    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.body = b"<html><head><title>Test</title></head><body>Content</body></html>"

    with patch("scrapling.fetchers.Fetcher.get", return_value=mock_resp) as mock_get:
        status, html = fetch_page_text("https://example.com/test")

        assert status == 200
        assert "Content" in html
        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        assert args[0] == "https://example.com/test"
        assert kwargs["follow_redirects"] is True
        assert kwargs["stealthy_headers"] is True


def test_fetch_page_text_stealth_escalation_on_challenge() -> None:
    mock_resp = MagicMock()
    mock_resp.status = 403
    mock_resp.body = b"Attention Required! | Cloudflare"

    mock_stealth = MagicMock()
    mock_stealth.status = 200
    mock_stealth.body = b"<html><head><title>Bypassed</title></head><body>Clean page</body></html>"

    with (
        patch("scrapling.fetchers.Fetcher.get", return_value=mock_resp),
        patch("scrapling.fetchers.StealthyFetcher.fetch", return_value=mock_stealth) as mock_fetch,
    ):
        status, html = fetch_page_text("https://protected.example.com")

        assert status == 200
        assert "Clean page" in html
        mock_fetch.assert_called_once_with(
            "https://protected.example.com",
            disable_resources=True,
            timeout=30000,
            real_chrome=True,
        )


def test_fetch_page_bytes() -> None:
    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.body = b"%PDF-1.4 mock binary content"

    with patch("scrapling.fetchers.Fetcher.get", return_value=mock_resp) as mock_get:
        data = fetch_page_bytes("https://example.com/doc.pdf")

        assert data == b"%PDF-1.4 mock binary content"
        mock_get.assert_called_once()


def test_extract_web_universal_scrapling() -> None:
    sample_html = """
    <html>
      <head><title>Blog Post</title><meta name="description" content="AI tools" /></head>
      <body><p>Read about https://github.com/myorg/tool</p></body>
    </html>
    """
    with patch("stash.extract.web.fetch_page_text", return_value=(200, sample_html)) as mock_fetch:
        source_doc, record = extract_web("https://example.com/blog/ai")

        assert record.title == "Blog Post"
        assert record.description == "AI tools"
        assert len(record.mentions) == 1
        assert record.mentions[0].name == "myorg/tool"
        assert source_doc.platform == "web"
        mock_fetch.assert_called_once_with("https://example.com/blog/ai", client=None)


def test_extract_notion_universal_scrapling() -> None:
    sample_html = """
    <html>
      <head><title>Roadmap | Notion</title></head>
      <body><div>Project Goals: see https://github.com/myorg/repo</div></body>
    </html>
    """
    with patch(
        "stash.extract.notion.fetch_page_text", return_value=(200, sample_html)
    ) as mock_fetch:
        source_doc, record = extract_notion("https://myteam.notion.site/roadmap")

        assert record.title == "Roadmap"
        assert len(record.mentions) == 1
        assert record.mentions[0].name == "myorg/repo"
        assert source_doc.platform == "notion"
        mock_fetch.assert_called_once_with(
            "https://myteam.notion.site/roadmap",
            client=None,
            stealth=True,
        )


def test_extract_github_scrape_universal_scrapling() -> None:
    sample_html = """
    <html>
      <head>
        <meta property="og:url" content="https://github.com/coolorg/cooltool" />
      </head>
      <body>
        <span id="repo-stars-counter-star" title="1,250">1.2k</span>
        <p class="f4">A great tool</p>
      </body>
    </html>
    """

    def mock_fetch(url: str, **kwargs: Any) -> tuple[int, str]:
        if "coolorg/cooltool/HEAD" in url:
            return 200, "# Tool README"
        return 200, sample_html

    with patch("stash.extract.github.fetch_page_text", side_effect=mock_fetch):
        record = extract_github_scrape("coolorg", "cooltool", client=None)

        assert record.canonical_key == "github:coolorg/cooltool"
        assert record.stars == 1250
        assert record.description == "A great tool"
        assert record.backend == "scrape"


def test_extract_hf_scrape_universal_scrapling() -> None:
    sample_html = """
    <html>
      <body>
        <p>Llama 3 8B model with .gguf quantized variants available.</p>
      </body>
    </html>
    """
    with patch("stash.extract.hf.fetch_page_text", return_value=(200, sample_html)):
        record = extract_hf_scrape("model", "meta-llama", "Meta-Llama-3-8B", client=None)

        assert record.canonical_key == "hf:model:meta-llama/meta-llama-3-8b"
        assert record.has_gguf is True
        assert record.backend == "scrape"


def test_extract_pdf_remote_universal_scrapling() -> None:
    import fitz  # pyright: ignore[reportMissingTypeStubs]

    doc: Any = fitz.open()
    page: Any = doc.new_page()
    page.insert_text((50, 50), "Sample Research Paper https://github.com/ai/model")
    pdf_bytes = bytes(doc.tobytes())

    with patch("stash.extract.pdf.fetch_page_bytes", return_value=pdf_bytes) as mock_bytes:
        source_doc, record = extract_pdf("https://arxiv.org/pdf/2401.12345.pdf")

        assert source_doc.platform == "pdf"
        assert len(record.mentions) == 1
        assert record.mentions[0].name == "ai/model"
        mock_bytes.assert_called_once_with(
            "https://arxiv.org/pdf/2401.12345.pdf",
            client=None,
        )
