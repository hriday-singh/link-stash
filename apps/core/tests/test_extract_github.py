"""Unit tests for GitHub extractor using recorded fixtures (offline)."""

import json
from pathlib import Path

import httpx
import pytest

from stash.errors import Invalid
from stash.extract.github import (
    extract_github,
    extract_github_api,
    extract_github_scrape,
    normalize_github_key,
    parse_github_url,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "github"


def test_parse_github_url() -> None:
    assert parse_github_url("https://github.com/owner/repo") == ("owner", "repo")
    assert parse_github_url("https://github.com/owner/repo/") == ("owner", "repo")
    assert parse_github_url("https://github.com/owner/repo.git") == ("owner", "repo")
    assert parse_github_url("https://github.com/owner/repo/tree/main/docs") == ("owner", "repo")
    assert parse_github_url("http://github.com/owner/repo?tab=readme") == ("owner", "repo")

    with pytest.raises(Invalid):
        parse_github_url("https://gitlab.com/owner/repo")
    with pytest.raises(Invalid):
        parse_github_url("not a url")


def test_normalize_github_key() -> None:
    assert normalize_github_key("Owner", "Repo") == "github:owner/repo"


def test_github_api_backend() -> None:
    api_data = json.loads((FIXTURES_DIR / "standard_api.json").read_text(encoding="utf-8"))
    tree_data = json.loads((FIXTURES_DIR / "tree_skill.json").read_text(encoding="utf-8"))

    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if "/git/trees/" in url_str:
            return httpx.Response(200, json=tree_data)
        if "/readme" in url_str:
            return httpx.Response(
                200,
                text="Check out https://github.com/other/tool and https://huggingface.co/meta-llama/Llama-3",
            )
        if "/repos/D4Vinci/Scrapling" in url_str:
            return httpx.Response(200, json=api_data)
        return httpx.Response(404)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    rec = extract_github_api("D4Vinci", "Scrapling", token="test-token", client=client)

    assert rec.canonical_key == "github:d4vinci/scrapling"
    assert rec.owner == "D4Vinci"
    assert rec.repo == "Scrapling"
    assert rec.stars == 5420
    assert rec.license == "MIT"
    assert rec.has_skill is True
    assert rec.has_plugin is False
    assert rec.backend == "api"
    assert len(rec.mentions) == 2
    mention_names = {m.name for m in rec.mentions}
    assert "other/tool" in mention_names
    assert "meta-llama/Llama-3" in mention_names


def test_github_scrape_backend() -> None:
    page_html = (FIXTURES_DIR / "standard_page.html").read_text(encoding="utf-8")

    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if "raw.githubusercontent.com" in url_str:
            if url_str.endswith("README.md"):
                return httpx.Response(200, text="Read our docs at https://github.com/other/lib")
            if url_str.endswith("SKILL.md"):
                return httpx.Response(200, text="# Skill")
            return httpx.Response(404)
        if "github.com" in url_str:
            return httpx.Response(200, text=page_html)
        return httpx.Response(404)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    rec = extract_github_scrape("D4Vinci", "Scrapling", client=client)

    assert rec.canonical_key == "github:d4vinci/scrapling"
    assert rec.stars == 5420
    assert rec.description == "Undetectable, powerful, and easy-to-use web scraping library"
    assert "scraping" in rec.topics
    assert rec.has_skill is True
    assert rec.backend == "scrape"
    assert len(rec.mentions) == 1
    assert rec.mentions[0].name == "other/lib"


def test_github_backend_parity() -> None:
    """Verify both API and scrape backends produce matching core fields for the same repo."""
    api_data = json.loads((FIXTURES_DIR / "standard_api.json").read_text(encoding="utf-8"))
    tree_data = json.loads((FIXTURES_DIR / "tree_skill.json").read_text(encoding="utf-8"))
    page_html = (FIXTURES_DIR / "standard_page.html").read_text(encoding="utf-8")

    api_client = httpx.Client(
        transport=httpx.MockTransport(
            lambda req: httpx.Response(200, json=tree_data)
            if "/git/trees/" in str(req.url)
            else httpx.Response(200, json=api_data)
        )
    )
    scrape_client = httpx.Client(
        transport=httpx.MockTransport(
            lambda req: httpx.Response(200, text="# Skill")
            if "SKILL.md" in str(req.url)
            else httpx.Response(200, text=page_html)
        )
    )

    api_rec = extract_github_api("D4Vinci", "Scrapling", token="dummy", client=api_client)
    scrape_rec = extract_github_scrape("D4Vinci", "Scrapling", client=scrape_client)

    assert api_rec.canonical_key == scrape_rec.canonical_key
    assert api_rec.stars == scrape_rec.stars
    assert api_rec.description == scrape_rec.description
    assert set(api_rec.topics) == set(scrape_rec.topics)
    assert api_rec.has_skill == scrape_rec.has_skill


def test_github_rename_handling() -> None:
    renamed_data = json.loads((FIXTURES_DIR / "renamed_api.json").read_text(encoding="utf-8"))

    client = httpx.Client(
        transport=httpx.MockTransport(lambda req: httpx.Response(200, json=renamed_data))
    )
    rec = extract_github_api("oldorg", "oldrepo", token="dummy", client=client)

    # Canonical name from full_name is neworg/newrepo
    assert rec.owner == "neworg"
    assert rec.repo == "newrepo"
    assert rec.canonical_key == "github:neworg/newrepo"


def test_extract_github_high_level_fallback() -> None:
    page_html = (FIXTURES_DIR / "standard_page.html").read_text(encoding="utf-8")

    def handler(request: httpx.Request) -> httpx.Response:
        # Simulate 401 on API endpoint
        if "api.github.com" in str(request.url):
            return httpx.Response(401, json={"message": "Bad credentials"})
        if "github.com" in str(request.url):
            return httpx.Response(200, text=page_html)
        return httpx.Response(404)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    source_doc, record = extract_github(
        "https://github.com/D4Vinci/Scrapling",
        client=client,
        token="expired_token",
    )

    assert record.backend == "scrape"
    assert source_doc.platform == "github"
    assert source_doc.key == "github:d4vinci/scrapling"
    assert source_doc.creator == "D4Vinci"
