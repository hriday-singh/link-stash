"""Tests for SQLite index, FTS5 search, card and source storage."""

from datetime import date, datetime
from pathlib import Path

import pytest

from stash.errors import NotFound
from stash.store.index import connect, get_db, rebuild, remove_path, save_card
from stash.store.models import Card, Mention, SourceDoc
from stash.store.sources import append_failed, read_source, write_source


def test_connect_and_schema_initialization(tmp_path: Path) -> None:
    con = connect(tmp_path)
    try:
        # Check WAL mode
        journal_mode = con.execute("PRAGMA journal_mode;").fetchone()[0]
        assert journal_mode.lower() == "wal"

        # Check tables exist
        tables = [
            row["name"]
            for row in con.execute(
                "SELECT name FROM sqlite_master WHERE type IN ('table', 'view')"
            ).fetchall()
        ]
        assert "cards" in tables
        assert "sources" in tables
        assert "links" in tables
        assert "tags" in tables
        assert "search" in tables
    finally:
        con.close()


def test_save_card_and_indexing(tmp_path: Path) -> None:
    card = Card(
        schema=1,
        key="github:test/repo",
        title="Test Repo",
        category="repos-tools",
        kind="repo",
        tags=["ai", "tools"],
        added=date(2026, 10, 5),
        url="https://github.com/test/repo",
        sources=["ig:DdpKWz1ymmi"],
        facts={"stars": 500},
        features=["feature1"],
        overlaps=["github:other/repo"],
    )
    body = "\n**What it is.** A test repository with a wikilink to [[target-slug]].\n"

    path = save_card(tmp_path, card, body)
    assert path.exists()
    assert path.name == "test-repo.md"

    with get_db(tmp_path) as db:
        # Verify card row
        card_row = db.execute("SELECT * FROM cards WHERE key = ?", (card.key,)).fetchone()
        assert card_row is not None
        assert card_row["title"] == "Test Repo"
        assert card_row["slug"] == "test-repo"
        assert card_row["category"] == "repos-tools"

        # Verify tags
        tags = [
            r["tag"]
            for r in db.execute("SELECT tag FROM tags WHERE key = ?", (card.key,)).fetchall()
        ]
        assert set(tags) == {"ai", "tools"}

        # Verify links: source, overlap, and wikilink
        links = db.execute(
            "SELECT to_key, type FROM links WHERE from_key = ?", (card.key,)
        ).fetchall()
        link_map = {r["to_key"]: r["type"] for r in links}
        assert link_map["ig:DdpKWz1ymmi"] == "source"
        assert link_map["github:other/repo"] == "overlap"
        assert link_map["slug:target-slug"] == "wikilink"

        # Verify FTS5 search
        search_hits = db.execute(
            "SELECT key FROM search WHERE search MATCH 'test repository'"
        ).fetchall()
        assert any(h["key"] == card.key for h in search_hits)


def test_save_card_slug_collision(tmp_path: Path) -> None:
    card1 = Card(
        schema=1,
        key="github:org/app",
        title="Cool App",
        category="repos-tools",
        kind="repo",
        added=date(2026, 10, 5),
    )
    card2 = Card(
        schema=1,
        key="github:other-org/app",
        title="Cool App",
        category="repos-tools",
        kind="repo",
        added=date(2026, 10, 5),
    )

    path1 = save_card(tmp_path, card1, "body 1")
    assert path1.name == "cool-app.md"

    path2 = save_card(tmp_path, card2, "body 2")
    assert path2.name == "cool-app-2.md"

    with get_db(tmp_path) as db:
        slug1 = db.execute("SELECT slug FROM cards WHERE key = ?", (card1.key,)).fetchone()["slug"]
        slug2 = db.execute("SELECT slug FROM cards WHERE key = ?", (card2.key,)).fetchone()["slug"]
        assert slug1 == "cool-app"
        assert slug2 == "cool-app-2"


def test_source_read_write_and_indexing(tmp_path: Path) -> None:
    doc = SourceDoc(
        key="ig:DdpKWz1ymmi",
        platform="instagram",
        creator="@developer",
        url="https://instagram.com/reel/DdpKWz1ymmi",
        stage="analyzed",
        engine="agy-headless",
        fetched_at=datetime(2026, 10, 5, 12, 0, 0),
        caption="Check out this tool! #ai",
        summary="A tool for managing links.",
        transcript="Hey everyone, today we look at...",
        mentions=[Mention(kind="tool", name="StashTool", url="https://example.com")],
        cta={"type": "comment", "keyword": "stash"},
        video=Path("library/sources/ig-DdpKWz1ymmi/video.mp4"),
        thumb=Path("library/sources/ig-DdpKWz1ymmi/thumb.jpg"),
    )

    source_path = write_source(tmp_path, doc)
    assert source_path.exists()

    loaded = read_source(tmp_path, doc.key)
    assert loaded.key == doc.key
    assert loaded.creator == doc.creator
    assert loaded.summary == doc.summary
    assert loaded.caption == doc.caption
    assert len(loaded.mentions) == 1
    assert loaded.mentions[0].name == "StashTool"

    with get_db(tmp_path) as db:
        source_row = db.execute("SELECT * FROM sources WHERE id = ?", (doc.key,)).fetchone()
        assert source_row is not None
        assert source_row["creator"] == "@developer"
        assert source_row["stage"] == "analyzed"

        # Search query over transcript
        hits = db.execute("SELECT key FROM search WHERE search MATCH 'everyone'").fetchall()
        assert any(h["key"] == doc.key for h in hits)


def test_read_source_not_found(tmp_path: Path) -> None:
    with pytest.raises(NotFound, match="Source document not found"):
        read_source(tmp_path, "ig:nonexistent")


def test_remove_path(tmp_path: Path) -> None:
    card = Card(
        schema=1,
        key="github:demo/remove",
        title="Remove Me",
        category="repos-tools",
        kind="repo",
        tags=["temp"],
        added=date(2026, 10, 5),
    )
    p = save_card(tmp_path, card, "temporary card")

    with get_db(tmp_path) as db:
        assert db.execute("SELECT key FROM cards WHERE key = ?", (card.key,)).fetchone() is not None

    p.unlink()
    remove_path(tmp_path, p)

    with get_db(tmp_path) as db:
        assert db.execute("SELECT key FROM cards WHERE key = ?", (card.key,)).fetchone() is None
        assert db.execute("SELECT tag FROM tags WHERE key = ?", (card.key,)).fetchone() is None


def test_rebuild_restores_index(tmp_path: Path) -> None:
    card = Card(
        schema=1,
        key="github:demo/rebuild",
        title="Rebuild Card",
        category="repos-tools",
        kind="repo",
        added=date(2026, 10, 5),
    )
    save_card(tmp_path, card, "sample body for rebuild")

    doc = SourceDoc(
        key="ig:rebuild123",
        platform="instagram",
        url="https://instagram.com/reel/rebuild123",
        stage="fetched",
        summary="A source summary for rebuild",
    )
    write_source(tmp_path, doc)

    # Delete index database
    db_file = tmp_path / ".index" / "stash.db"
    assert db_file.exists()
    db_file.unlink()

    # Rebuild from files
    counts = rebuild(tmp_path)
    assert counts["cards"] == 1
    assert counts["sources"] == 1

    with get_db(tmp_path) as db:
        assert db.execute("SELECT key FROM cards WHERE key = ?", (card.key,)).fetchone() is not None
        assert db.execute("SELECT id FROM sources WHERE id = ?", (doc.key,)).fetchone() is not None


def test_append_failed(tmp_path: Path) -> None:
    append_failed(tmp_path, {"key": "ig:fail1", "reason": "blocked:login"})
    append_failed(tmp_path, {"key": "ig:fail2", "reason": "timeout"})

    failed_file = tmp_path / "logs" / "failed.jsonl"
    assert failed_file.exists()
    lines = failed_file.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 2
    assert "blocked:login" in lines[0]
    assert "timeout" in lines[1]
