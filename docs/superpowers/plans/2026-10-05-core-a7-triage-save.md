# A7 Check, Save, and Queue: Plan

**Goal:** Implement deduplication and overlap candidate scoring (`stash check`), card saving (`stash save`), reject and pending queue management, and Instagram data export backlog import (`stash import-ig-export`).
**Spec:** `docs/link-stash-spec.md` (Dedup and check, Overlap ranking, Review and confirmation, Instagram data export, Build order A7). Contract: `2026-10-05-library-app-00-overview.md` (`stash.services.rejects`, `stash.services.pending`).
**Stack adds:** `rapidfuzz` (string similarity & token ranking).

## Constraints
- Every write operation takes `STASH_HOME/.lock`.
- Pure evaluation: `stash check` performs no mutations, returning classification (duplicate, rejected, overlap, new) and suggested card attributes.
- Card save enforces unique slugs across the entire library; colliding titles receive `-2`, `-3` suffixes.
- `pending.md`, `rejected.md`, and `queue.md` are plain markdown files at `STASH_HOME/library/` with clean line-oriented formats.
- Precondition for B1: Completing A7 along with A4 satisfies the full Core contract consumed by the FastAPI web server.
- Never commit; checkpoint after each task.

## Review focus
1. **Deduplication order:** Exact identity key match -> exact URL match -> reject history match -> fuzzy overlap score.
2. **RapidFuzz overlap scoring:** Compares extracted mention names and tags against library cards and inventory items; score >= 75 flags candidate overlap.
3. **Atomic card saving:** Card file written atomically into `library/items/<category>/<slug>.md` and immediately indexed into SQLite.
4. **Queue state integrity:** `stash import-ig-export` parses Instagram's `saved_posts.json` without failing on malformed entries and filters out already-processed keys.
5. **Pending lifecycle:** Comment-for-link items added with status "open"; resolving with DM'd link sets status "ready" and records URL.

---

### Task 1: Check & Deduplication Service
- **Files:** `apps/core/src/stash/services/check.py`, `apps/core/tests/test_service_check.py`.
- **Approach:**
  - `check_item(home: Path, item: CheckInput) -> CheckResult`:
    - Queries `cards` index table by `key` and `url`. If found: returns status `duplicate_library` with existing card category and slug.
    - Queries `inventory` index table by `key` and normalized name. If found: returns status `duplicate_inventory` with origin tool name.
    - Queries `rejects` index table by `key`. If found: returns status `previously_rejected` with date and reason.
    - If no exact match: runs `rapidfuzz.fuzz.token_sort_ratio` against all existing card titles and inventory item names. Matches >= 75 returned as `overlaps: list[OverlapMatch]`.
    - Returns `CheckResult(status="new" | "duplicate" | "overlap", suggested_category, overlaps, message)`.
- **Tests:** Exact key hit; URL alias hit; reject history hit; RapidFuzz similarity detection; clean new item result.

### Task 2: Rejects & Pending Services
- **Files:** `apps/core/src/stash/services/rejects.py`, `apps/core/src/stash/services/pending.py`, `apps/core/tests/test_service_rejects_pending.py`.
- **Approach:**
  - `add_reject(home: Path, key: str, reason: str) -> RejectEntry`:
    - Takes `write_lock`. Appends row to `library/rejected.md`. Reindexes rejects table.
  - `remove_reject(home: Path, key: str) -> None`:
    - Takes lock. Removes row from `library/rejected.md` or raises `NotFound`. Reindexes.
  - `list_pending(home: Path) -> list[PendingItem]`:
    - Reads `library/pending.md` (or index table).
  - `add_pending(home: Path, item: PendingItem) -> None`:
    - Takes lock. Appends item to `library/pending.md`. Reindexes pending table.
  - `resolve_pending(home: Path, id: str, url: str) -> PendingItem`:
    - Takes lock. Updates item in `library/pending.md` with resolved URL and sets status to `ready`.
- **Tests:** Reject append and un-reject; pending add, list, and resolve flow; error when resolving non-existent pending ID.

### Task 3: Card Save Service
- **Files:** `apps/core/src/stash/services/cards.py`, `apps/core/tests/test_service_save_card.py`.
- **Approach:**
  - `save_card_service(home: Path, card: Card, body: str, slug: str | None = None) -> Path`:
    - Takes `write_lock`.
    - If `slug` not provided: generates slug from `card.title` (`re.sub(r'[^a-z0-9]+', '-', title.lower())`).
    - Resolves unique slug by checking SQLite `cards` table; appends `-2`, `-3` if colliding.
    - Writes file atomically via `store.cards.save_card`.
    - Updates source stage to `saved` if source keys are present.
- **Tests:** Clean save with auto-slug; slug collision resolution; frontmatter validation; index row verification.

### Task 4: Instagram Data Export Backlog Importer
- **Files:** `apps/core/src/stash/extract/ig_export.py`, `apps/core/services/queue.py`, `apps/core/tests/fixtures/ig_export.json`, `apps/core/tests/test_ig_export.py`.
- **Approach:**
  - `parse_ig_export(file_path: Path) -> list[tuple[str, str]]`:
    - Parses Instagram JSON export structure (`saved_posts` / `saved_media`).
    - Normalizes URLs to `ig:<shortcode>` keys.
  - `import_ig_backlog(home: Path, export_file: Path) -> int`:
    - Takes `write_lock`.
    - Filters out keys already present in `cards`, `rejects`, or `queue.md`.
    - Appends new items to `library/queue.md`.
    - Returns count of newly queued links.
  - `pop_queue(home: Path, count: int = 10) -> list[str]`:
    - Takes next N links from `library/queue.md` and removes them under lock.
- **Tests:** Parse sample Instagram export fixture; filter existing items; queue pop and atomic file update.

### Task 5: CLI Subcommands
- **Files:** `apps/core/src/stash/cli/triage.py`, `apps/core/tests/test_cli_triage.py`.
- **Approach:**
  - `stash check <record.json>`: runs check service, prints JSON result.
  - `stash save <card.json>`: reads card JSON, saves card, prints path and slug.
  - `stash reject <key> --reason <reason>`: adds reject, prints JSON record.
  - `stash pending list`: prints list of pending items.
  - `stash pending add <json>`: adds pending item.
  - `stash pending resolve <id> --url <url>`: resolves pending item.
  - `stash import-ig-export <file>`: imports backlog, prints queued count.
- **Tests:** CLI tests for check, save, reject, pending, and backlog import with JSON output.
- **Done:** Duplicate checks prevent re-saving; RapidFuzz flags overlapping tools; IG backlog populates queue; unit tests, ruff, pyright green.
