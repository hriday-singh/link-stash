"""SQLite derived index and FTS5 search for Link Stash."""

import json
import re
import sqlite3
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import yaml

from stash.store.cards import content_hash, parse_card
from stash.store.lists import (
    parse_all,
    parse_inventory_line,
    parse_pending_line,
    parse_reject_line,
)
from stash.store.lock import write_lock
from stash.store.models import Card

SCHEMA_VERSION = 1

DDL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS cards (
        key TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        kind TEXT NOT NULL,
        added TEXT NOT NULL,
        url TEXT,
        hash TEXT NOT NULL,
        mtime REAL NOT NULL,
        frontmatter TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        creator TEXT,
        url TEXT NOT NULL,
        stage TEXT NOT NULL,
        video TEXT,
        thumb TEXT,
        engine TEXT,
        fetched_at TEXT,
        cta TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS links (
        from_key TEXT NOT NULL,
        to_key TEXT NOT NULL,
        type TEXT NOT NULL,
        PRIMARY KEY (from_key, to_key, type)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS tags (
        key TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (key, tag)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS inventory (
        key TEXT,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        origin TEXT NOT NULL,
        PRIMARY KEY (name, origin)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS rejects (
        key TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        reason TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS pending (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        source_key TEXT,
        instruction TEXT NOT NULL,
        url TEXT,
        status TEXT NOT NULL,
        added TEXT NOT NULL
    );
    """,
    """
    CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(
        key UNINDEXED,
        doc_type UNINDEXED,
        title,
        body,
        transcript,
        caption
    );
    """,
]


def init_db(con: sqlite3.Connection) -> None:
    """Initialize database tables and set schema version."""
    for stmt in DDL_STATEMENTS:
        con.execute(stmt)
    con.execute(f"PRAGMA user_version = {SCHEMA_VERSION};")
    con.commit()


def drop_all_tables(con: sqlite3.Connection) -> None:
    """Drop all tables and FTS virtual tables to prepare for rebuild."""
    tables = ["cards", "sources", "links", "tags", "inventory", "rejects", "pending", "search"]
    for table in tables:
        con.execute(f"DROP TABLE IF EXISTS {table};")
    con.commit()


def connect(home: Path) -> sqlite3.Connection:
    """Connect to the SQLite database at STASH_HOME/.index/stash.db in WAL mode."""
    home = Path(home)
    index_dir = home / ".index"
    index_dir.mkdir(parents=True, exist_ok=True)
    db_path = index_dir / "stash.db"

    # FastAPI runs sync dependency setup, endpoint, and teardown on different
    # threadpool threads. Each connection is still used by one request at a time.
    con = sqlite3.connect(str(db_path), check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL;")
    con.execute("PRAGMA foreign_keys=ON;")

    cur = con.execute("PRAGMA user_version;")
    version_row = cur.fetchone()
    current_version = version_row[0] if version_row else 0

    if current_version != SCHEMA_VERSION:
        drop_all_tables(con)
        init_db(con)

    return con


@contextmanager
def get_db(home: Path, con: sqlite3.Connection | None = None) -> Generator[sqlite3.Connection]:
    """Helper to use an existing connection or open and close a new one."""
    if con is not None:
        yield con
    else:
        c = connect(home)
        try:
            yield c
        finally:
            c.close()


def reindex_path(home: Path, path: Path, con: sqlite3.Connection | None = None) -> None:
    """Reindex a specific file (card, source, inventory, etc.) into the SQLite index."""
    home = Path(home)
    path = Path(path)

    if not path.exists():
        remove_path(home, path, con=con)
        return

    # Ignore temp files, lock files, and index directory
    if ".tmp" in path.name or path.name.startswith(".lock") or ".index" in path.parts:
        return

    rel_parts = path.relative_to(home).parts
    posix_path = path.relative_to(home).as_posix()

    with get_db(home, con) as db:
        # Check if card: library/items/<category>/<slug>.md
        if (
            len(rel_parts) >= 3
            and rel_parts[0] == "library"
            and rel_parts[1] == "items"
            and path.suffix == ".md"
        ):
            _index_card(home, path, posix_path, db)
        # Check if source: library/sources/<source-dir>/source.md
        elif (
            len(rel_parts) >= 3
            and rel_parts[0] == "library"
            and rel_parts[1] == "sources"
            and path.name == "source.md"
        ):
            _index_source(home, path, db)
        elif rel_parts == ("library", "rejected.md"):
            _index_rejects(path, db)
        elif rel_parts == ("library", "pending.md"):
            _index_pending(path, db)
        # Inventory: inventory/auto/<tool>.md, inventory/manual/<name>.md
        elif len(rel_parts) >= 2 and rel_parts[0] == "inventory" and path.suffix == ".md":
            _index_inventory(home, path, db)
        db.commit()


def _index_card(home: Path, path: Path, posix_path: str, db: sqlite3.Connection) -> None:
    text = path.read_text(encoding="utf-8")
    card, body = parse_card(text)
    slug = path.stem
    c_hash = content_hash(text)
    mtime = path.stat().st_mtime
    fm_json = card.model_dump_json(by_alias=True)

    db.execute(
        """
        INSERT OR REPLACE INTO cards (
            key, path, slug, title, category, kind, added, url, hash, mtime, frontmatter
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            card.key,
            posix_path,
            slug,
            card.title,
            card.category,
            card.kind,
            str(card.added),
            card.url,
            c_hash,
            mtime,
            fm_json,
        ),
    )

    # Tags
    db.execute("DELETE FROM tags WHERE key = ?", (card.key,))
    for tag in card.tags:
        db.execute("INSERT OR IGNORE INTO tags (key, tag) VALUES (?, ?)", (card.key, tag))

    # Links: sources, overlaps, and wikilinks
    db.execute("DELETE FROM links WHERE from_key = ?", (card.key,))
    for src in card.sources:
        db.execute(
            "INSERT OR IGNORE INTO links (from_key, to_key, type) VALUES (?, ?, ?)",
            (card.key, src, "source"),
        )
    for ov in card.overlaps:
        db.execute(
            "INSERT OR IGNORE INTO links (from_key, to_key, type) VALUES (?, ?, ?)",
            (card.key, ov, "overlap"),
        )

    # Wikilinks: [[slug]]
    wikilinks = re.findall(r"\[\[([a-zA-Z0-9_\-]+)\]\]", body)
    for target_slug in wikilinks:
        row = db.execute("SELECT key FROM cards WHERE slug = ?", (target_slug,)).fetchone()
        target_key = row["key"] if row else f"slug:{target_slug}"
        db.execute(
            "INSERT OR IGNORE INTO links (from_key, to_key, type) VALUES (?, ?, ?)",
            (card.key, target_key, "wikilink"),
        )

    # Search FTS5
    db.execute("DELETE FROM search WHERE key = ?", (card.key,))
    extra_text = " ".join([*card.tags, *card.features])
    search_body = f"{body}\n{extra_text}".strip() if extra_text else body
    db.execute(
        """
        INSERT INTO search (key, doc_type, title, body, transcript, caption)
        VALUES (?, 'card', ?, ?, NULL, NULL)
        """,
        (card.key, card.title, search_body),
    )


def _index_source(home: Path, path: Path, db: sqlite3.Connection) -> None:
    text = path.read_text(encoding="utf-8")
    fm_raw = ""
    caption = ""
    if text.startswith("---\n"):
        parts = text[4:].split("\n---\n", 1)
        if len(parts) == 2:
            fm_raw, caption = parts
        elif text[4:].endswith("\n---"):
            fm_raw = text[4:-4]
    elif text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            fm_raw = parts[1]
            caption = parts[2]

    try:
        data: dict[str, Any] = yaml.safe_load(fm_raw) or {}
    except Exception:
        data = {}

    key = str(data.get("key") or path.parent.name.replace("-", ":", 1))
    platform = str(data.get("platform") or "unknown")
    creator = data.get("creator")
    url = str(data.get("url") or "")
    stage = str(data.get("stage") or "fetched")
    video = str(data.get("video") or "") if data.get("video") else None
    thumb = str(data.get("thumb") or "") if data.get("thumb") else None
    engine = data.get("engine")
    fetched_at = str(data.get("fetched_at") or "") if data.get("fetched_at") else None
    cta_json = json.dumps(data.get("cta")) if data.get("cta") else None
    summary = data.get("summary")
    transcript = data.get("transcript")

    db.execute(
        """
        INSERT OR REPLACE INTO sources (
            id, platform, creator, url, stage, video, thumb, engine, fetched_at, cta
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (key, platform, creator, url, stage, video, thumb, engine, fetched_at, cta_json),
    )

    db.execute("DELETE FROM search WHERE key = ?", (key,))
    db.execute(
        """
        INSERT INTO search (key, doc_type, title, body, transcript, caption)
        VALUES (?, 'source', NULL, ?, ?, ?)
        """,
        (key, summary, transcript, caption.strip() or None),
    )


def _index_inventory(home: Path, path: Path, db: sqlite3.Connection) -> None:
    """One row per `- [kind] name (key: k)` line; origin is relative to inventory/."""
    try:
        origin = path.relative_to(home / "inventory").as_posix()
    except Exception:
        origin = path.stem
    db.execute("DELETE FROM inventory WHERE origin = ?", (origin,))
    db.execute(
        "DELETE FROM search WHERE doc_type = 'inventory' AND body LIKE ?",
        (f"%origin:{origin}%",),
    )
    for e in parse_all(
        path.read_text(encoding="utf-8"), lambda ln: parse_inventory_line(ln, origin)
    ):
        # ponytail: PK is (name, origin), so a same-named second entry in one file is dropped
        db.execute(
            "INSERT OR IGNORE INTO inventory (key, name, kind, origin) VALUES (?, ?, ?, ?)",
            (e.key, e.name, e.kind, e.origin),
        )
        inv_search_key = e.key or f"inv:{e.origin}:{e.name}"
        inv_body = f"[{e.kind}] {e.note or ''} origin:{e.origin}".strip()
        db.execute(
            """
            INSERT INTO search (key, doc_type, title, body, transcript, caption)
            VALUES (?, 'inventory', ?, ?, NULL, NULL)
            """,
            (inv_search_key, e.name, inv_body),
        )


def _index_rejects(path: Path, db: sqlite3.Connection) -> None:
    db.execute("DELETE FROM rejects")
    for e in parse_all(path.read_text(encoding="utf-8"), parse_reject_line):
        db.execute(
            "INSERT OR REPLACE INTO rejects (key, date, reason) VALUES (?, ?, ?)",
            (e.key, e.date.isoformat(), e.reason),
        )


def _index_pending(path: Path, db: sqlite3.Connection) -> None:
    db.execute("DELETE FROM pending")
    for p in parse_all(path.read_text(encoding="utf-8"), parse_pending_line):
        db.execute(
            """
            INSERT OR REPLACE INTO pending (id, kind, source_key, instruction, url, status, added)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (p.id, p.kind, p.source_key, p.instruction, p.url, p.status, p.added.isoformat()),
        )


def remove_path(home: Path, path: Path, con: sqlite3.Connection | None = None) -> None:
    """Remove indexed rows for a deleted file."""
    home = Path(home)
    path = Path(path)
    posix_path = path.relative_to(home).as_posix()

    with get_db(home, con) as db:
        # Check if card was deleted
        card_row = db.execute("SELECT key FROM cards WHERE path = ?", (posix_path,)).fetchone()
        if card_row:
            card_key = card_row["key"]
            db.execute("DELETE FROM cards WHERE key = ?", (card_key,))
            db.execute("DELETE FROM tags WHERE key = ?", (card_key,))
            db.execute("DELETE FROM links WHERE from_key = ?", (card_key,))
            db.execute("DELETE FROM search WHERE key = ?", (card_key,))
            db.commit()
            return

        rel_parts = path.relative_to(home).parts
        if rel_parts == ("library", "rejected.md"):
            db.execute("DELETE FROM rejects")
        elif rel_parts == ("library", "pending.md"):
            db.execute("DELETE FROM pending")
        elif rel_parts and rel_parts[0] == "inventory" and path.suffix == ".md":
            try:
                origin = path.relative_to(home / "inventory").as_posix()
            except Exception:
                origin = path.stem
            db.execute("DELETE FROM inventory WHERE origin = ?", (origin,))
            db.execute(
                "DELETE FROM search WHERE doc_type = 'inventory' AND body LIKE ?",
                (f"%origin:{origin}%",),
            )
        db.commit()

        # Check if source was deleted
        if len(rel_parts) >= 3 and rel_parts[0] == "library" and rel_parts[1] == "sources":
            source_id = rel_parts[2].replace("-", ":", 1)
            db.execute("DELETE FROM sources WHERE id = ?", (source_id,))
            db.execute("DELETE FROM search WHERE key = ?", (source_id,))
            db.commit()


def rebuild(home: Path) -> dict[str, int]:
    """Acquire write_lock, clear all index tables, and reindex all files.

    Scans under library/ and inventory/.
    """
    home = Path(home)
    with write_lock(home):
        db = connect(home)
        try:
            drop_all_tables(db)
            init_db(db)

            # Reindex library/items/
            items_dir = home / "library" / "items"
            card_count = 0
            if items_dir.exists():
                for card_file in items_dir.rglob("*.md"):
                    if not card_file.name.endswith(".tmp") and ".tmp." not in card_file.name:
                        reindex_path(home, card_file, con=db)
                        card_count += 1

            # Reindex library/sources/
            sources_dir = home / "library" / "sources"
            source_count = 0
            if sources_dir.exists():
                for source_file in sources_dir.glob("*/source.md"):
                    reindex_path(home, source_file, con=db)
                    source_count += 1

            # Reindex inventory/ (auto/ and manual/)
            inv_dir = home / "inventory"
            if inv_dir.exists():
                for inv_file in inv_dir.rglob("*.md"):
                    if ".tmp" not in inv_file.name:
                        reindex_path(home, inv_file, con=db)

            for name in ("rejected.md", "pending.md"):
                list_file = home / "library" / name
                if list_file.is_file():
                    reindex_path(home, list_file, con=db)

            db.commit()
            inventory_count = db.execute("SELECT COUNT(*) FROM inventory").fetchone()[0]
            return {"cards": card_count, "sources": source_count, "inventory": inventory_count}
        finally:
            db.close()


def save_card(home: Path, card: Card, body: str, slug: str | None = None) -> Path:
    """Acquire write lock, resolve unique slug, write card atomically, and reindex."""
    from stash.store.cards import save_card as _save_card

    return _save_card(home, card, body, slug)
