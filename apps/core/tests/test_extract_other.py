"""Unit tests for Notion, Web, and PDF extractors."""

from pathlib import Path

from stash.extract.notion import (
    extract_notion_content,
    is_notion_url,
    normalize_url_key,
)
from stash.extract.pdf import extract_pdf
from stash.extract.web import extract_web_content


def test_is_notion_url() -> None:
    assert is_notion_url("https://my-team.notion.site/My-Page-12345") is True
    assert is_notion_url("https://notion.so/workspace/Page") is True
    assert is_notion_url("https://github.com/owner/repo") is False


def test_normalize_url_key() -> None:
    assert (
        normalize_url_key("https://www.example.com/blog/post-1?utm_source=rss#frag")
        == "url:example.com/blog/post-1"
    )


def test_notion_content_parse() -> None:
    html = """
    <html>
      <head><title>Product Roadmap | Notion</title></head>
      <body>
        <h1>Product Roadmap</h1>
        <p>Checkout our tool at https://github.com/myorg/awesome-tool and https://example.com/docs</p>
      </body>
    </html>
    """
    rec = extract_notion_content(html, "https://myteam.notion.site/roadmap")
    assert rec.title == "Product Roadmap"
    assert rec.canonical_key == "url:myteam.notion.site/roadmap"
    assert len(rec.mentions) == 1
    assert rec.mentions[0].name == "myorg/awesome-tool"
    assert "https://example.com/docs" in rec.outbound_links


def test_extract_web_content() -> None:
    html = """
    <html>
      <head>
        <title>Announcing Project Alpha</title>
        <meta name="description" content="A new approach to agent memory" />
      </head>
      <body>
        <p>We released https://github.com/alpha-org/alpha-core today!</p>
        <a href="https://external.org/benchmarks">Benchmarks</a>
      </body>
    </html>
    """
    rec = extract_web_content(html, "https://blog.example.com/announcing-alpha")
    assert rec.title == "Announcing Project Alpha"
    assert rec.description == "A new approach to agent memory"
    assert len(rec.mentions) == 1
    assert rec.mentions[0].name == "alpha-org/alpha-core"
    assert "https://external.org/benchmarks" in rec.outbound_links


def test_extract_pdf_mock_data(tmp_path: Path) -> None:
    from typing import Any

    import fitz  # pyright: ignore[reportMissingTypeStubs]

    pdf_file = tmp_path / "sample.pdf"
    doc: Any = fitz.open()
    page: Any = doc.new_page()
    page.insert_text(
        (50, 50), "Sample Paper mentioning https://github.com/ai/research-paper for research."
    )
    doc.save(str(pdf_file))
    doc.close()

    source_doc, rec = extract_pdf(str(pdf_file))
    assert source_doc.platform == "pdf"
    assert rec.title == "sample"
    assert len(rec.mentions) == 1
    assert rec.mentions[0].name == "ai/research-paper"
