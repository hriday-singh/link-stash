# A4 Store and Index: Plan

**Goal:** Establish the markdown storage engine, byte-identical card serialization, file-locking, SQLite derived index with FTS5, file watcher, and reindex CLI.
**Spec:** `docs/link-stash-spec.md` (Store and index, Library, Card format, Seed categories). Contract: `2026-10-05-library-app-00-overview.md` (`stash.store.*`).
**Stack adds:** stdlib `sqlite3`, `watchfiles`, `pyyaml`.

## Constraints
- Does not edit A2 or A3 extractor/engine files.
- Single writer: Every write takes `STASH_HOME/.lock` with reentrant handling in-process and 30 s timeout.
- Card serialization is 100% byte-stable: reading and writing an unchanged card produces byte-identical output. Frontmatter key ordering is deterministic.
- Slugs are library-wide unique: colliding slugs append numeric suffixes (`-2`, `-3`).
- SQLite index is disposable and derived strictly from markdown: deleting `.index/stash.db` and running `stash reindex` restores all query results with zero data loss.
- Never commit; checkpoint after each task.

## Review focus
1. **Byte-identical round-trip:** `parse_card` + `render_card` produces byte-identical text across all card kinds.
2. **Reentrant write lock:** Lock acquired multiple times in the same thread succeeds without deadlock; second process times out after 30 s with `LockTimeout`.
3. **Atomic writes:** Writes go to a temp file (`*.tmp`) in the destination folder and atomic-rename into place; temp files are ignored by indexer and watcher.
4. **Index schema rebuild:** Schema mismatch or missing DB automatically creates tables (`cards`, `sources`, `links`, `tags`, `inventory`, `rejects`, `pending`, `search` FTS5) in WAL mode.
5. **Backlink & Wikilink resolution:** Body `[[slug]]` and frontmatter `sources`/`overlaps` populate the `links` table. Unresolved slugs record as `to_key = 'slug:<slug>'`.
6. **Watcher batching:** Changes reindexed before yielding, ignoring temp files.

---

### Task 1: Store Models & Card Serialization
- **Files:** `apps/core/src/stash/store/models.py`, `apps/core/src/stash/store/cards.py`, `apps/core/tests/test_store_cards.py`.
- **Approach:**
  - Complete `models.py` per contract: `SEED_CATEGORIES`, `Kind`, `Card`, `Mention`, `SourceDoc`, `PendingItem`, `RejectEntry`, `InventoryEntry`.
  - Implement `card_path(home, category, slug) -> Path`.
  - Implement `parse_card(text) -> tuple[Card, str]` (YAML frontmatter + markdown body).
  - Implement `render_card(card, body) -> str` (fixed frontmatter key order, normalized newlines).
  - Implement `content_hash(text) -> str` (SHA-256 of normalized body + frontmatter text).
  - Implement `write_atomic(path, text)` (temp file + rename, UTF-8, newline `\n`).
- **Tests:** Round-trip tests asserting byte-identical results; invalid frontmatter raises `Invalid`; hash stability; atomic write permissions and clean overwrite.

### Task 2: Reentrant File Lock
- **Files:** `apps/core/src/stash/store/lock.py`, `apps/core/tests/test_store_lock.py`.
- **Approach:**
  - `@contextmanager def write_lock(home: Path) -> Iterator[None]`:
    - Tracks thread-local reentrancy depth.
    - If depth == 0: attempts exclusive file lock on `STASH_HOME/.lock`.
    - Polls with backoff up to 30 s before raising `LockTimeout("Lock held by another process")`.
    - Releases lock file on outermost exit.
- **Tests:** Same-thread nested acquisition succeeds; contention from a second thread/process times out after timeout; stale lock recovery.

### Task 3: SQLite Index Schema & Connection
- **Files:** `apps/core/src/stash/store/index.py`, `apps/core/tests/test_store_index.py`.
- **Approach:**
  - SQLite database at `STASH_HOME/.index/stash.db`.
  - `connect(home: Path) -> sqlite3.Connection`:
    - Enables WAL mode (`PRAGMA journal_mode=WAL`), foreign keys, sets `row_factory = sqlite3.Row`.
    - Verifies schema version (`user_version`). On mismatch or missing DB, drops/recreates schema.
  - Tables:
    - `cards`: `key` (PK), `path`, `slug` (UNIQUE), `title`, `category`, `kind`, `added`, `url`, `hash`, `mtime`, `frontmatter` (JSON).
    - `sources`: `id` (PK), `platform`, `creator`, `url`, `stage`, `video`, `thumb`, `engine`, `fetched_at`, `cta` (JSON).
    - `links`: `from_key`, `to_key`, `type` (`source` | `overlap` | `wikilink`).
    - `tags`: `key`, `tag`.
    - `inventory`: `key`, `name`, `kind`, `origin`.
    - `rejects`: `key`, `date`, `reason`.
    - `pending`: `id`, `kind`, `source_key`, `instruction`, `url`, `status`, `added`.
    - `search` (FTS5): `key UNINDEXED`, `doc_type UNINDEXED` (`card` | `source`), `title`, `body`, `transcript`, `caption`.
- **Tests:** Schema creation; WAL pragma verification; version mismatch triggers clean rebuild.

### Task 4: Card & Source Indexing
- **Files:** `apps/core/src/stash/store/index.py`, `apps/core/src/stash/store/sources.py`, `apps/core/tests/test_indexing.py`.
- **Approach:**
  - `reindex_path(home: Path, path: Path) -> None`:
    - If path is card (`library/items/<category>/<slug>.md`): parse, extract tags, parse `[[slug]]` wikilinks from body, populate `cards`, `tags`, `links`, `search`.
    - If path is source (`library/sources/<id>/source.md`): parse frontmatter, populate `sources`, `search`.
    - If path in `inventory/`, `pending.md`, `rejected.md`: populate respective tables.
  - `remove_path(home: Path, path: Path) -> None`: removes rows for deleted files.
  - `rebuild(home: Path) -> None`: acquires `write_lock`, clears index tables, walks `library/` and `inventory/`, reindexes every file.
  - `save_card(home, card, body, slug=None) -> Path`: takes lock, allocates slug, writes atomically, reindexes.
  - `read_source(home, key) -> SourceDoc` & `write_source(home, doc) -> Path`.
- **Tests:** Indexing single card; wikilink extraction; FTS5 search query returns matching card; rebuild after deleting `.index/stash.db` restores all records.

### Task 5: File Watcher
- **Files:** `apps/core/src/stash/store/watcher.py`, `apps/core/tests/test_store_watcher.py`.
- **Approach:**
  - `async def watch(home: Path) -> AsyncIterator[set[tuple[watchfiles.Change, Path]]]`:
    - Watches `library/` and `inventory/`.
    - Ignores `*.tmp`, `.lock`, and `.index/`.
    - Collects change batches; reindexes or removes path via `index.reindex_path` / `index.remove_path` *before* yielding change set to consumer.
- **Tests:** Mocked watchfiles changes trigger reindexing; temporary files ignored.

### Task 6: CLI `stash reindex`
- **Files:** `apps/core/src/stash/cli/store.py` (or integrated into `cli`), `apps/core/tests/test_cli_store.py`.
- **Approach:**
  - `stash reindex`: runs `rebuild(home)`, prints JSON `{status: "ok", indexed: {cards: N, sources: N}}`.
- **Tests:** CLI rebuild command returns 0 and correct JSON count.
- **Done:** cards round-trip byte-identical, full reindex restores DB, all unit tests, ruff, pyright green.
