"""Unit tests for card save and merge service."""

from datetime import date
from pathlib import Path

from stash.services.cards import save, save_card_service
from stash.store.cards import parse_card
from stash.store.index import connect
from stash.store.models import Card, SourceDoc
from stash.store.sources import read_source, write_source


def test_save_new_card(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    card = Card(
        schema=1,
        key="github:cool/tool",
        title="Cool Tool",
        category="repos-tools",
        kind="tool",
        added=date(2026, 10, 6),
    )
    result = save_card_service(home, card, "# Cool Tool\nAwesome description.")
    assert result.status == "saved"
    assert result.slug == "cool-tool"
    assert result.key == "github:cool/tool"

    # Verify SQLite row
    db = connect(home)
    row = db.execute("SELECT * FROM cards WHERE key = ?", ("github:cool/tool",)).fetchone()
    assert row is not None
    assert row["slug"] == "cool-tool"
    assert row["category"] == "repos-tools"
    db.close()


def test_save_slug_collision(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    card1 = Card(
        schema=1,
        key="github:org1/dup",
        title="Duplicate Name",
        category="repos-tools",
        kind="tool",
        added=date(2026, 10, 6),
    )
    res1 = save(home, card1, "# Doc 1")
    assert res1.slug == "duplicate-name"

    card2 = Card(
        schema=1,
        key="github:org2/dup",
        title="Duplicate Name",
        category="repos-tools",
        kind="tool",
        added=date(2026, 10, 6),
    )
    res2 = save(home, card2, "# Doc 2")
    assert res2.slug == "duplicate-name-2"


def test_save_merges_existing_card_and_updates_source(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    # Pre-create a source in stage "analyzed"
    source = SourceDoc(
        key="ig:C99999",
        platform="instagram",
        creator="creator1",
        url="https://www.instagram.com/reel/C99999/",
        stage="analyzed",
    )
    write_source(home, source)

    card = Card(
        schema=1,
        key="github:existing/tool",
        title="Existing Tool",
        category="repos-tools",
        kind="tool",
        added=date(2026, 10, 6),
        sources=["ig:C11111"],
        overlaps=["tool:alpha"],
    )
    res1 = save(home, card, "# Body v1\nNotes here.")
    assert res1.status == "saved"

    # Second save with new source and new overlap
    card_update = Card(
        schema=1,
        key="github:existing/tool",
        title="Different Title Ignored",
        category="repos-tools",
        kind="tool",
        added=date(2026, 10, 6),
        sources=["ig:C99999"],
        overlaps=["tool:beta"],
    )
    res2 = save(home, card_update, "# Body v2 Ignored")
    assert res2.status == "merged"
    assert res2.slug == res1.slug

    # Verify card on disk kept original title and body, but unioned sources & overlaps
    card_file = home / res1.path
    saved_card, body = parse_card(card_file.read_text(encoding="utf-8"))
    assert saved_card.title == "Existing Tool"
    assert "ig:C11111" in saved_card.sources
    assert "ig:C99999" in saved_card.sources
    assert "tool:alpha" in saved_card.overlaps
    assert "tool:beta" in saved_card.overlaps
    assert "Body v1" in body

    # Verify source was transitioned to "triaged"
    updated_source = read_source(home, "ig:C99999")
    assert updated_source.stage == "triaged"
