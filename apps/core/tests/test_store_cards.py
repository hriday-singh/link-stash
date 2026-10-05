"""Tests for stash store models and card serialization."""

from datetime import date
from pathlib import Path

import pytest

from stash.errors import Invalid
from stash.store.cards import (
    card_path,
    content_hash,
    parse_card,
    render_card,
    slugify,
    write_atomic,
)
from stash.store.models import Card


def test_card_path() -> None:
    home = Path("/test/home")
    p = card_path(home, "repos-tools", "stash-core")
    assert p == home / "library" / "items" / "repos-tools" / "stash-core.md"


def test_slugify() -> None:
    assert slugify("Repo Name") == "repo-name"
    assert slugify("HydraFusion v2.0 (High Speed!)") == "hydrafusion-v2-0-high-speed"
    assert slugify("---") == "untitled"


def test_card_round_trip() -> None:
    card = Card(
        schema=1,
        key="github:owner/repo",
        title="Repo Name",
        category="repos-tools",
        kind="repo",
        tags=["agents", "scraping"],
        added=date(2026, 10, 5),
        url="https://github.com/owner/repo",
        sources=["ig:DdpKWz1ymmi"],
        facts={"stars": 12400, "license": "MIT", "archived": False},
        features=["feature-1"],
        overlaps=["github:other/repo"],
    )
    body = (
        "\n**What it is.** One line description.\n\n"
        "**Notes.** Optional notes with [[other-slug]].\n"
    )

    rendered = render_card(card, body)
    parsed_card, parsed_body = parse_card(rendered)

    assert parsed_card.key == card.key
    assert parsed_card.title == card.title
    assert parsed_card.category == card.category
    assert parsed_card.kind == card.kind
    assert parsed_card.tags == card.tags
    assert parsed_card.added == card.added
    assert parsed_card.url == card.url
    assert parsed_card.sources == card.sources
    assert parsed_card.facts == card.facts
    assert parsed_card.features == card.features
    assert parsed_card.overlaps == card.overlaps
    assert parsed_body == body

    # Second render must be byte-identical to first render
    re_rendered = render_card(parsed_card, parsed_body)
    assert re_rendered == rendered


def test_parse_card_invalid_format() -> None:
    with pytest.raises(Invalid, match="must start with '---'"):
        parse_card("No frontmatter at all")

    with pytest.raises(Invalid, match="missing closing '---'"):
        parse_card("---\nschema: 1\ntitle: test\n")

    with pytest.raises(Invalid, match="Invalid YAML"):
        parse_card("---\n: invalid yaml :\n---\nbody")

    with pytest.raises(Invalid, match="Invalid card frontmatter schema"):
        # Missing required key 'key', 'title', 'category', 'kind', 'added'
        parse_card("---\nschema: 1\n---\nbody")


def test_content_hash_line_ending_stability() -> None:
    text_unix = "---\nschema: 1\n---\n\nbody\n"
    text_win = "---\r\nschema: 1\r\n---\r\n\r\nbody\r\n"
    assert content_hash(text_unix) == content_hash(text_win)


def test_write_atomic(tmp_path: Path) -> None:
    target = tmp_path / "subdir" / "card.md"
    content = "---\nschema: 1\n---\n\n**Body**\n"
    write_atomic(target, content)

    assert target.exists()
    assert target.read_text(encoding="utf-8") == content

    # Overwrite test
    updated_content = "---\nschema: 1\n---\n\n**Updated**\n"
    write_atomic(target, updated_content)
    assert target.read_text(encoding="utf-8") == updated_content

    # No leftover .tmp files
    tmp_files = list((tmp_path / "subdir").glob("*.tmp*"))
    assert len(tmp_files) == 0
