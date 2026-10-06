# `stash suggest` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `stash suggest` consultation command and `stash-suggest` agent skill to let developers and AI agents search saved library cards, installed tools, and practices before writing code or installing new packages.

**Architecture:** Extend inventory models to preserve description notes, index inventory items and card tags into the existing SQLite FTS5 `search` table, provide a tokenized BM25 query service that partitions results into `installed`, `cards`, and `practices` with an explicit `found: bool` skip flag, expose a CLI command via Typer with JSON and `--text` formatting, and package as a portable agent skill for Claude Code and Antigravity.

**Tech Stack:** Python 3.14, SQLite 3 (FTS5 + BM25), Pydantic v2, Typer, Pytest, UV.

**Spec:** `docs/superpowers/specs/2026-10-06-stash-suggest-design.md`

## Global Constraints

- Follow established monorepo patterns in `apps/core`.
- Maintain strict type hints (`pyright` strict clean).
- Zero new runtime dependencies (use existing standard library + sqlite3 + pydantic + typer).
- Preserve existing SQLite schema without requiring DDL drops or migrations.
- Keep execution latency under 50ms for CLI responsiveness.
- All code formatted with `ruff` and passing `pytest`.
- User rule: Never run database migrations, make code changes only, do not commit directly to git.

---

### Task 1: Inventory Note Preservation in Models & Lists

**Files:**
- Modify: `apps/core/src/stash/store/models.py`
- Modify: `apps/core/src/stash/store/lists.py:31-53`
- Test: `apps/core/tests/test_store_lists.py`

**Interfaces:**
- Consumes: `InventoryEntry` model.
- Produces: `InventoryEntry(key: str | None, name: str, kind: str, origin: str, note: str | None = None)`.

- [ ] **Step 1: Write the failing test**

In `apps/core/tests/test_store_lists.py`, add:
```python
def test_parse_inventory_line_with_note():
    from stash.store.lists import parse_inventory_line

    line = "- [ui_ref] shadcn/ui — Modular reusable React component system (key: url:ui.shadcn.com)"
    entry = parse_inventory_line(line, "manual/ui-ux.md")
    assert entry is not None
    assert entry.name == "shadcn/ui"
    assert entry.kind == "ui_ref"
    assert entry.key == "url:ui.shadcn.com"
    assert entry.origin == "manual/ui-ux.md"
    assert entry.note == "Modular reusable React component system"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-sync --directory apps/core pytest apps/core/tests/test_store_lists.py -k test_parse_inventory_line_with_note -v`
Expected: FAIL (`AttributeError: 'InventoryEntry' object has no attribute 'note'` or `AssertionError`).

- [ ] **Step 3: Update `InventoryEntry` and `parse_inventory_line`**

In `apps/core/src/stash/store/models.py`:
```python
class InventoryEntry(BaseModel):
    key: str | None = None
    name: str
    kind: str
    origin: str
    note: str | None = None
```

In `apps/core/src/stash/store/lists.py`:
```python
def parse_inventory_line(line: str, origin: str) -> InventoryEntry | None:
    m = _INV.match(line)
    if not m:
        return None
    rest = m["rest"]
    key = None
    if k := _KEY.search(rest):
        key, rest = k["key"], rest[: k.start()]
    parts = rest.split(SEP, 1)
    name = parts[0].strip()
    if not name:
        return None
    note = parts[1].strip() if len(parts) > 1 and parts[1].strip() else None
    return InventoryEntry(key=key, name=name, kind=m["kind"] or "tool", origin=origin, note=note)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-sync --directory apps/core pytest apps/core/tests/test_store_lists.py -v`
Expected: PASS.

---

### Task 2: Multi-Source FTS5 Indexing in Store Index

**Files:**
- Modify: `apps/core/src/stash/store/index.py:264-273,328-343`
- Test: `apps/core/tests/test_store_index.py`

**Interfaces:**
- Consumes: `_index_card`, `_index_inventory`.
- Produces: Search rows in FTS5 `search` table with `doc_type = 'card'` and `doc_type = 'inventory'`, including tags and notes.

- [ ] **Step 1: Write the failing test**

In `apps/core/tests/test_store_index.py`, add:
```python
def test_inventory_and_card_tags_indexed_in_fts(tmp_path):
    from stash.store.index import connect, reindex_path

    home = tmp_path
    inv_dir = home / "inventory" / "manual"
    inv_dir.mkdir(parents=True)
    inv_file = inv_dir / "ui-ux.md"
    inv_file.write_text("- [ui_ref] Lenis — Smooth scrolling library (key: url:lenis.dev)\n", encoding="utf-8")

    reindex_path(home, inv_file)

    con = connect(home)
    row = con.execute("SELECT * FROM search WHERE search MATCH 'scrolling'").fetchone()
    assert row is not None
    assert row["doc_type"] == "inventory"
    assert row["title"] == "Lenis"
    con.close()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-sync --directory apps/core pytest apps/core/tests/test_store_index.py -k test_inventory_and_card_tags_indexed_in_fts -v`
Expected: FAIL (`assert None is not None`).

- [ ] **Step 3: Update `_index_card` and `_index_inventory` in `apps/core/src/stash/store/index.py`**

In `_index_card`:
```python
    # Search FTS5
    db.execute("DELETE FROM search WHERE key = ?", (card.key,))
    extra = " ".join([*card.tags, *card.features])
    search_body = f"{body}\n{extra}".strip() if extra else body
    db.execute(
        """
        INSERT INTO search (key, doc_type, title, body, transcript, caption)
        VALUES (?, 'card', ?, ?, NULL, NULL)
        """,
        (card.key, card.title, search_body),
    )
```

In `_index_inventory`:
```python
def _index_inventory(home: Path, path: Path, db: sqlite3.Connection) -> None:
    try:
        origin = path.relative_to(home / "inventory").as_posix()
    except Exception:
        origin = path.stem
    db.execute("DELETE FROM inventory WHERE origin = ?", (origin,))
    # Clear old search entries for this origin
    db.execute("DELETE FROM search WHERE doc_type = 'inventory' AND body LIKE ?", (f"%origin:{origin}%",))
    for e in parse_all(
        path.read_text(encoding="utf-8"), lambda ln: parse_inventory_line(ln, origin)
    ):
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-sync --directory apps/core pytest apps/core/tests/test_store_index.py -k test_inventory_and_card_tags_indexed_in_fts -v`
Expected: PASS.

---

### Task 3: Suggest Query & Relevance Scoring in Queries & Service

**Files:**
- Modify: `apps/core/src/stash/store/queries.py`
- Create: `apps/core/src/stash/services/suggest.py`
- Test: `apps/core/tests/test_service_suggest.py`

**Interfaces:**
- Produces: `suggest_items(home: Path, query: str, category: str | None = None, kind: str | None = None, limit: int = 5) -> SuggestResult`.

- [ ] **Step 1: Write the failing test**

Create `apps/core/tests/test_service_suggest.py`:
```python
from pathlib import Path
from stash.services.suggest import suggest_items
from stash.store.index import reindex_path

def test_suggest_returns_partitioned_results_and_skip_flag(tmp_path: Path):
    home = tmp_path
    # Create inventory
    inv_dir = home / "inventory" / "manual"
    inv_dir.mkdir(parents=True)
    (inv_dir / "ui-ux.md").write_text("- [ui_ref] Motion — Smooth React motion and animation (key: url:motion.dev)\n", encoding="utf-8")
    (inv_dir / "practices.md").write_text("- [practice] Declare what to preserve — Explicit negative constraints in UI (key: practice:ui-preserve)\n", encoding="utf-8")
    reindex_path(home, inv_dir / "ui-ux.md")
    reindex_path(home, inv_dir / "practices.md")

    # Positive match
    res = suggest_items(home, "react animation")
    assert res.found is True
    assert any(item.name == "Motion" for item in res.installed)

    # Practice match
    res_practice = suggest_items(home, "negative constraints")
    assert res_practice.found is True
    assert any("preserve" in p.name.lower() for p in res_practice.practices)

    # Empty match returns found: False
    res_empty = suggest_items(home, "kubernetes cluster helm")
    assert res_empty.found is False
    assert len(res_empty.installed) == 0
    assert len(res_empty.cards) == 0
    assert len(res_empty.practices) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-sync --directory apps/core pytest apps/core/tests/test_service_suggest.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'stash.services.suggest'`).

- [ ] **Step 3: Implement `suggest_matches` in `queries.py` and `suggest_items` in `services/suggest.py`**

In `apps/core/src/stash/store/queries.py`, implement helper `suggest_search_rows(conn, query, limit=30)`:
Sanitizes query into tokens, builds FTS query `(tok1* OR tok2* ...)`, executes FTS search with `bm25(search)` rank. Also joins `cards`, `tags`, and `inventory` to resolve metadata.

In `apps/core/src/stash/services/suggest.py`, define models:
- `InstalledSuggestion(name, kind, origin, note, key)`
- `CardSuggestion(title, slug, category, kind, tags, url, snippet)`
- `PracticeSuggestion(name, slug_or_key, summary, origin)`
- `SuggestResult(query, found, installed, cards, practices)`

Implement `suggest_items(home, query, category=None, kind=None, limit=5)`:
Fetches matches, groups into `installed`, `cards`, and `practices`. Applies deduplication and score thresholds. If all buckets are empty, sets `found = False`.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-sync --directory apps/core pytest apps/core/tests/test_service_suggest.py -v`
Expected: PASS.

---

### Task 4: CLI Command `stash suggest`

**Files:**
- Create: `apps/core/src/stash/cli/suggest.py`
- Modify: `apps/core/src/stash/cli/__init__.py:1-25`
- Test: `apps/core/tests/test_cli_suggest.py`

**Interfaces:**
- Produces: CLI command `stash suggest <query> [--category <cat>] [--kind <kind>] [--limit <n>] [--text]`.

- [ ] **Step 1: Write the failing test**

Create `apps/core/tests/test_cli_suggest.py`:
```python
from typer.testing import CliRunner
from stash.cli import app

runner = CliRunner()

def test_cli_suggest_json_and_text():
    result = runner.invoke(app, ["suggest", "--help"])
    assert result.exit_code == 0
    assert "Suggest installed tools, saved library cards, and practices" in result.output
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-sync --directory apps/core pytest apps/core/tests/test_cli_suggest.py -v`
Expected: FAIL (`No such command 'suggest'`).

- [ ] **Step 3: Implement `suggest.py` and register in Typer `app`**

Create `apps/core/src/stash/cli/suggest.py`:
- `register_suggest_commands(app: typer.Typer) -> None`
- Command `suggest(query, category, kind, limit, text)`
- If `text` is true, prints clean markdown; otherwise prints JSON via `_print(result.model_dump(mode="json"))`.

In `apps/core/src/stash/cli/__init__.py`:
- Import `register_suggest_commands`
- Call `register_suggest_commands(app)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-sync --directory apps/core pytest apps/core/tests/test_cli_suggest.py -v`
Expected: PASS.

---

### Task 5: Agent Skill `skills/stash-suggest/SKILL.md` & Installer Update

**Files:**
- Create: `skills/stash-suggest/SKILL.md`
- Modify: `apps/core/src/stash/services/skills.py`
- Test: `apps/core/tests/test_service_skills.py`

**Interfaces:**
- Consumes: `stash suggest` CLI.
- Produces: `skills/stash-suggest/SKILL.md` installed via `stash install-skills`.

- [ ] **Step 1: Write the failing test**

In `apps/core/tests/test_service_skills.py`, check that `stash-suggest` is in the recognized skill list.
Expected: FAIL.

- [ ] **Step 2: Create `skills/stash-suggest/SKILL.md`**

Define frontmatter:
```markdown
---
name: stash-suggest
description: Consult Link Stash for relevant installed tools, saved library cards, or practices before installing new packages or planning features.
---
```
Document usage, flags, and the `found: false` skip condition.

- [ ] **Step 3: Update `apps/core/src/stash/services/skills.py`**

Ensure `install_skills` discovers `stash-suggest` and copies or symlinks it into Claude Code and Antigravity skill directories.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-sync --directory apps/core pytest apps/core/tests/test_service_skills.py -v`
Expected: PASS.

---

### Task 6: Progress Tracker Update & Live Stash Verification

**Files:**
- Modify: `docs/progress-tracker.md`
- Live verify: `stash reindex` on `C:\Users\clash\stash`
- Run lint, typecheck, and full test suite (`pnpm test:core`, `uv run --no-sync --directory apps/core ruff check`, `uv run --no-sync --directory apps/core pyright`)

- [ ] **Step 1: Update `docs/progress-tracker.md`**
Record Milestone A11 with status, test coverage, and deliverable list.

- [ ] **Step 2: Run all core checks**
Run:
- `pnpm test:core`
- `uv run --no-sync --directory apps/core ruff check`
- `uv run --no-sync --directory apps/core pyright`

- [ ] **Step 3: Live Verification on Real Stash**
Run:
- `uv run --directory apps/core stash reindex`
- `uv run --directory apps/core stash suggest "react animation"`
- `uv run --directory apps/core stash suggest "prompting preserve" --text`
- `uv run --directory apps/core stash suggest "kubernetes cluster helm"` (confirming `found: false`)
