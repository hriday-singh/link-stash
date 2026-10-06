# Link Stash Progress Tracker & Spec Traceability

October 6, 2026 · Comprehensive Milestone Audit

---

## 1. Executive Summary & Dashboard

Link Stash is divided into two interdependent parts:
1. **Core Pipeline (Part 1, A-Series):** CLI, extractors, reel understanding engines, markdown card store, SQLite FTS5 index, inventory scanning, triage services, and portable agent skills.
2. **Library Web App (Part 2, B-Series):** Local single-page application (`apps/web`) served by `stash serve` (FastAPI), providing feed browsing, video playback, conflict-safe card editing, backlinks, graph visualization, and stash-specific views.

### Overall Completion Status

| Area | Milestones Defined | Completed / Substantially Done | Planned / In Progress | Completion % |
| --- | --- | --- | --- | --- |
| **Core Pipeline (A1–A11)** | 11 | 10 complete/logic done (A1–A9, A11) | 1 planned (A10) | **91%** |
| **Web Application (B0–B6)** | 7 | 7 complete (B0–B6) | 0 planned | **100%** |
| **Combined System** | 18 | 17 complete/logic done | 1 planned (A10) | **94%** |


### Automated Verification Scorecard

| Component | Test Suite | Pass Count | Lint Status | Typecheck Status | Build Status |
| --- | --- | --- | --- | --- | --- |
| **`apps/core` (Python 3.14)** | Pytest 9.1.1 (35 modules) | **241 / 241 passing** (100%) | Ruff: 0 errors | Pyright (strict): 0 errors | N/A (Python package) |
| **`apps/web` (React 19 / Vite)** | Vitest 5.0.3 (47 test files) | **225 / 225 passing** (100%) | ESLint: 0 errors | `tsc -b`: 0 errors | Vite build: **clean production build** |
| **Total Automated Tests** | Pytest + Vitest | **466 tests passing** | Clean | Strict clean | Production build clean |


---

## 2. Milestone-by-Milestone Progress Matrix

### Core Pipeline Milestones (A-Series)

| Milestone | Code | Spec Reference | Plan Document | Status | Test Coverage | Key Deliverables |
| --- | --- | --- | --- | --- | --- | --- |
| **A1 Scaffold** | `A1` | [link-stash-spec.md](file:///docs/link-stash-spec.md#L486) | [2026-10-05-core-a1-scaffold.md](file:///docs/superpowers/plans/2026-10-05-core-a1-scaffold.md) | **Complete (100%)** | 13 tests (`test_cli.py`, `test_config.py`) | `apps/core` uv project, `stash.config`, `stash.errors`, `stash doctor`, `.github/workflows/ci.yml`. |
| **A2 Instagram Extractor** | `A2` | [link-stash-spec.md](file:///docs/link-stash-spec.md#L141-L170) | [2026-10-05-core-a2-instagram.md](file:///docs/superpowers/plans/2026-10-05-core-a2-instagram.md) | **Complete (100% logic)** | 39 tests (`test_keys.py`, `test_instagram_parse.py`, `test_extract_service.py`) | Scrapling embed fetch, media download with resumability, CTA keyword detection, `failed.jsonl` error logging. |
| **A3 Reel Engines** | `A3` | [link-stash-spec.md](file:///docs/link-stash-spec.md#L171-L235) | [2026-10-05-core-a3-reel-engines.md](file:///docs/superpowers/plans/2026-10-05-core-a3-reel-engines.md) | **Complete (100%)** | 41 tests (`test_reel_*.py`, `test_cli_reel.py`, `test_reel_live.py`) | `schemas/reel.json`, `prompt.md`, `agy` headless engine, `gemini_api` engine, `frames` fallback, `stash analyze`, `stash ingest`, Oct 5 test reels live verification. |
| **A4 Store and Index** | `A4` | [link-stash-spec.md](file:///docs/link-stash-spec.md#L324-L345) | [2026-10-05-core-a4-store-index.md](file:///docs/superpowers/plans/2026-10-05-core-a4-store-index.md) | **Complete (100%)** | 22 tests (`test_store_cards.py`, `test_store_index.py`, `test_store_lock.py`, `test_store_watcher.py`, `test_cli_store.py`) | Byte-identical card serialization, SHA-256 hash, reentrant write lock, SQLite index with 8 tables + FTS5 search, watchfiles watcher, `stash reindex`. |
| **A5 Other Extractors** | `A5` | [link-stash-spec.md](file:///docs/link-stash-spec.md#L141-L154) | [2026-10-05-core-a5-other-extractors.md](file:///docs/superpowers/plans/2026-10-05-core-a5-other-extractors.md) | **Complete (100% logic)** | 27 tests (`test_extract_github.py`, `test_extract_hf.py`, `test_extract_other.py`, `test_extract_scrapling.py`, `test_extract_dispatch.py`) | GitHub dual-backend (API + scrape), Hugging Face Hub + scrape, Notion, PDF, generic web, 1-level follow-through dispatcher. |
| **A6 Inventory** | `A6` | [link-stash-spec.md](file:///docs/link-stash-spec.md#L236-L269) | [2026-10-05-core-a6-inventory.md](file:///docs/superpowers/plans/2026-10-05-core-a6-inventory.md) | **Complete (100% logic)** | 3 tests (`test_service_inventory.py`) | Host scanners (Claude, Antigravity, Codex, Qwen, tools, Ollama, LM Studio, HF cache), 24h freshness check, `inventory/auto/` and `inventory/manual/`, `scan_inventory` and `have` services. |
| **A7 Check, Save** | `A7` | [link-stash-spec.md](file:///docs/link-stash-spec.md#L366-L372) | [2026-10-05-core-a7-triage-save.md](file:///docs/superpowers/plans/2026-10-05-core-a7-triage-save.md) | **Complete (100% logic)** | 10 tests (`test_service_check.py`, `test_service_rejects_pending.py`, `test_service_save_card.py`) | Exact dedup, RapidFuzz overlap ranking (`check_item`), card save with slug collision & source stage updates (`save`), `rejects`, `pending`. |
| **A8 Agent Skills** | `A8` | [link-stash-spec.md](file:///docs/link-stash-spec.md#L348-L408) | Planned | **Complete (100% logic)** | 2 tests (`test_service_skills.py`) | 5 portable `SKILL.md` files: `skills/stash/`, `skills/stash-init/`, `skills/stash-have/`, `skills/stash-pending/`, `skills/stash-scan/`; `install_skills` junction/symlink installer service. |
| **A9 Fallbacks** | `A9` | [link-stash-spec.md](file:///docs/link-stash-spec.md#L494) | Planned | **Complete (100% logic)** | 11 tests (`test_reel_frames.py`, `test_reel_whisper.py`, `test_reel_service.py`, `test_extract_service.py`) | Frames engine is now a handoff (not cached; `analyze` prints `needs_agent`, agent pipes to `ingest`). Contact sheet: opening frame + scene cuts + 5 s cadence, source-time labels. Optional faster-whisper transcript (`[whisper]` extra + `whisper = true`, offered in `/stash-init`). Blocked embed: manual mp4, else `blocked` pending item. No cookies, no export. `reel_engines` read from config. |
| **A10 First Real Run** | `A10` | [link-stash-spec.md](file:///docs/link-stash-spec.md#L495) | Planned | **Planned (0%)** | 0 tests | Full end-to-end user test with backlog import and initial manual inventory seeding. Ready to run. |
| **A11 Suggest Engine** | `A11` | [2026-10-06-stash-suggest-design.md](file:///docs/superpowers/specs/2026-10-06-stash-suggest-design.md) | [2026-10-06-stash-suggest.md](file:///docs/superpowers/plans/2026-10-06-stash-suggest.md) | **Complete (100%)** | 4 tests (`test_service_suggest.py`, `test_cli_suggest.py`, FTS index & lists) | `stash suggest` CLI (JSON + `--text`), FTS5 multi-indexing for inventory notes and card tags, partitioned suggest service (`installed`, `cards`, `practices`, `found: bool`), `skills/stash-suggest` agent skill installed across Claude Code, Antigravity, and workspace. |


---

### Library Web App Milestones (B-Series)

| Milestone | Code | Spec Reference | Plan Document | Status | Test Coverage | Key Deliverables |
| --- | --- | --- | --- | --- | --- | --- |
| **B0 Visual Design** | `B0` | [library-app-spec.md](file:///docs/library-app-spec.md#L224-L232) | [2026-10-05-library-app-b0-design.md](file:///docs/superpowers/plans/2026-10-05-library-app-b0-design.md) | **Complete (100%)** | 51 tests | `tokens.css` with 0 hardcoded colors/px, WCAG AA contrast tests, system/manual theme toggle, `Tile`, `GeneratedTile`, `CategoryPill`, `SegmentedControl`, `StashLogo`, `MorphIcon`, mock feed, card, and interactive views. |
| **B1 Serve and API** | `B1` | [library-app-spec.md](file:///docs/library-app-spec.md#L170-L192) | [2026-10-05-library-app-b1-api.md](file:///docs/superpowers/plans/2026-10-05-library-app-b1-api.md) | **Complete (100%)** | 33 tests (`test_store_notes.py`, `test_services_paging.py`, `test_server_api.py`, `test_server_events.py`, `test_cli_serve.py`) | `stash serve` FastAPI server, CRUD endpoints, Notes section parser/patcher, range-supported media streaming, watcher SSE events, OpenAPI TS types (`schema.d.ts`), typed client (`client.ts`). |
| **B2 Shell, Grid, Search** | `B2` | [library-app-spec.md](file:///docs/library-app-spec.md#L59-L98) | [2026-10-05-library-app-b2-shell.md](file:///docs/superpowers/plans/2026-10-05-library-app-b2-shell.md) | **Complete (100%)** | 85 tests (17 test files) | TanStack Router, AppShell, collapsible/resizable sidebar & drawer, Lenis smooth scroll, shared virtualized grid, Feed/category/search routes, Ctrl+K palette, URL filters, live sync SSE. |
| **B3 Card Page** | `B3` | [library-app-spec.md](file:///docs/library-app-spec.md#L126-L138) | [2026-10-05-library-app-b3-card.md](file:///docs/superpowers/plans/2026-10-05-library-app-b3-card.md) | **Complete (100%)** | 49 tests (11 new test files; 134 total web tests) | `/c/$slug` route, read-only markdown body, CodeMirror 6 Notes editor with `[[slug]]` autocomplete, autosave with serialized 409 conflict banner, Properties form with ChipInput, Reject dialog, connection panels. |
| **B4 Stash Views** | `B4` | [library-app-spec.md](file:///docs/library-app-spec.md#L151-L158) | [2026-10-05-library-app-b4-stash-views.md](file:///docs/superpowers/plans/2026-10-05-library-app-b4-stash-views.md) | **Complete (100%)** | 48 tests (11 test files; 182 total web tests) | Sources list with URL search filters, Source detail page with HTML5 video player and seekable timestamp chips/transcript, Pending resolve form with HTTP/HTTPS validation, Rejected table with quiet 404 un-reject, Inventory grouped view (`groupByOrigin`) with manual add form, brand logo suite (`thesvg.org` SVGs). |
| **B5 Backlinks and Graph** | `B5` | [library-app-spec.md](file:///docs/library-app-spec.md#L144-L150) | [2026-10-05-library-app-b5-graph.md](file:///docs/superpowers/plans/2026-10-05-library-app-b5-graph.md) | **Complete (100%)** | 29 tests (in web: `LinkPanels.test.tsx`, `colorResolver.test.ts`, `toGraphology.test.ts`, `GraphView.test.tsx`, `LocalGraph.test.tsx`, `GlobalGraph.test.tsx`, plus server `test_graph_and_links`) | Card link panels (backlinks, mentions with thumbnails/platform icons, outgoing with status badges), sigma.js WebGL graph visualization with ForceAtlas2 worker (off-thread with 2.0s stop budget), dynamic CSS token color resolver, isolated card badge, local 1/2-hop neighborhood on card page, full global `/graph` view with filters and routing. |
| **B6 Polish Pass** | `B6` | [library-app-spec.md](file:///docs/library-app-spec.md#L228-L232) | [2026-10-05-library-app-b6-polish.md](file:///docs/superpowers/plans/2026-10-05-library-app-b6-polish.md) | **Complete (100%)** | 16 tests (`MorphIcon.test.tsx`, `TextMorph.test.tsx`, `Player.test.tsx`, `Tile.test.tsx`, `VirtualGrid.test.tsx`, `tokens.test.tsx`) | Native View Transitions API (`view-transition-name: card-<slug>`), Motion layout reordering and AnimatePresence list exit animations with `useReducedMotion` fallback, spring-animated `MorphIcon`, `TextMorph` title & count transitions, accessible theme toggle, bundle size audit (`scripts/check-bundle.mjs`, initial chunk 121 KB gzip < 250 KB budget), passing all 4 quality gates. |

---

## 3. Core Contract Compliance Matrix

The Core Contract defined in [2026-10-05-library-app-00-overview.md](file:///docs/superpowers/plans/2026-10-05-library-app-00-overview.md#L22-L100) specifies exact types, functions, and interfaces shared between the Core pipeline and the FastAPI backend.

| Contract Element | Expected Location | Implementation Status | Notes |
| --- | --- | --- | --- |
| `Config`, `load_config` | `stash.config` | **Complete** | In [config.py](file:///apps/core/src/stash/config.py). Supports `home`, `port`, `category_colors`, `web_dist`. |
| `StashError`, `NotFound`, `Conflict`, `Invalid`, `LockTimeout` | `stash.errors` | **Complete** | In [errors.py](file:///apps/core/src/stash/errors.py). All error codes and `to_dict()` formatting match spec. |
| `SEED_CATEGORIES`, `Kind`, `Card` | `stash.store.models` | **Complete** | In [models.py](file:///apps/core/src/stash/store/models.py). Strict Pydantic models with `schema` alias. |
| `Mention`, `SourceDoc` | `stash.store.models` | **Complete** | In [models.py](file:///apps/core/src/stash/store/models.py). Field types and defaults match contract. |
| `PendingItem`, `RejectEntry`, `InventoryEntry` | `stash.store.models` | **Complete** | In [models.py](file:///apps/core/src/stash/store/models.py). Defined per contract. |
| `card_path`, `parse_card`, `render_card` | `stash.store.cards` | **Complete** | In [cards.py](file:///apps/core/src/stash/store/cards.py). Byte-identical round-trip verified. |
| `content_hash`, `write_atomic`, `save_card` | `stash.store.cards` | **Complete** | In [cards.py](file:///apps/core/src/stash/store/cards.py). Atomic write with temp-rename and index update. |
| `write_lock` | `stash.store.lock` | **Complete** | In [lock.py](file:///apps/core/src/stash/store/lock.py). In-process reentrant with 30s timeout. |
| `connect`, `rebuild`, `reindex_path`, `remove_path` | `stash.store.index` | **Complete** | In [index.py](file:///apps/core/src/stash/store/index.py). SQLite WAL mode, schema versioning, FTS5 table. |
| `read_source`, `write_source` | `stash.store.sources` | **Complete** | In [sources.py](file:///apps/core/src/stash/store/sources.py). Writes `source.md` and `raw.json`. |
| `watch` | `stash.store.watcher` | **Complete** | In [watcher.py](file:///apps/core/src/stash/store/watcher.py). Async generator using `watchfiles`. |
| `add_reject`, `remove_reject` | `stash.services.rejects` | **Complete** | In [rejects.py](file:///apps/core/src/stash/services/rejects.py). Atomic append/remove with reindexing. |
| `list_pending`, `add_pending`, `resolve_pending` | `stash.services.pending` | **Complete** | In [pending.py](file:///apps/core/src/stash/services/pending.py). Lifecycle with status open/ready and CTA filtering. |
| `have`, `scan_inventory` | `stash.services.inventory` | **Complete** | In [inventory.py](file:///apps/core/src/stash/services/inventory.py). 9 host scanners, 24h freshness, manual files. |
| `check_item` | `stash.services.check` | **Complete** | In [check.py](file:///apps/core/src/stash/services/check.py). Exact match + RapidFuzz token overlap scoring. |
| `save` / `save_card_service` | `stash.services.cards` | **Complete** | In [cards.py](file:///apps/core/src/stash/services/cards.py). Unique slug resolving, source stage transition to triaged. |
| `install_skills` | `stash.services.skills` | **Complete** | In [skills.py](file:///apps/core/src/stash/services/skills.py). Junction/symlink installer for Claude & Antigravity. |
| `app` (Typer CLI) | `stash.cli:app` | **Complete** | In [cli/__init__.py](file:///apps/core/src/stash/cli/__init__.py). All spec subcommands registered; triage commands in [cli/triage.py](file:///apps/core/src/stash/cli/triage.py) (11 tests, `test_cli_triage.py`). |

---

## 4. Detailed Component & Subsystem Audit

### A. Extractors & Reel Understanding

| Component | Target File | Implemented Symbols / Features | Missing / Pending Work | Status |
| --- | --- | --- | --- | --- |
| **Instagram Extractor** | `stash/extract/instagram.py` | `parse_embed`, `detect_cta`, `IgRecord`, `MediaItem` | None for parsing logic. | **100% Done** |
| **Instagram Service** | `stash/services/extract.py` | `extract`, `fetch_embed`, `_download`, `_extract_one`, `failed_urls`, batching, jitter | Multi-extractor router complete. | **100% Done** |
| **Reel Models & Schema** | `stash/reel/models.py`, `schemas/reel.json` | `ReelRecord`, `ReelMention`, `ReelCta`, JSON schema | None. | **100% Done** |
| **Reel System Prompt** | `stash/reel/prompt.md` | Mention rules, feature nesting rules, takeaway rules | None. | **100% Done** |
| **Antigravity Headless** | `stash/reel/agy.py` | `run_agy_headless`, process spawn, structured output | None. | **100% Done** |
| **Gemini API Engine** | `stash/reel/gemini_api.py` | `run_gemini_api`, inline (<20MB), Files API (>=20MB) | `google-genai` integration complete. | **100% Done** |
| **Frames Engine** | `stash/reel/frames.py` | `generate_contact_sheet`, scene cuts + 5 s cadence, `whisper.transcribe` (optional) | None. | **100% Done** |
| **Reel Service** | `stash/services/reel.py` | `analyze_reel`, `ingest_reel`, engine fallback chain, cache | None. | **100% Done** |
| **GitHub Extractor** | `stash/extract/github.py` | `parse_github_url`, `extract_github_api`, `extract_github_scrape`, `extract_github`, `GithubRecord` | Dual backend complete with tests. | **100% Done** |
| **Hugging Face Extractor** | `stash/extract/hf.py` | `parse_hf_url`, `extract_hf_api`, `extract_hf_scrape`, `extract_hf`, `HfRecord` | Hub API + scrape backend with GGUF detection complete. | **100% Done** |
| **Notion Extractor** | `stash/extract/notion.py` | `extract_notion_content`, `extract_notion`, `is_notion_url`, `NotionRecord` | Scraper and markdown converter complete with tests. | **100% Done** |
| **PDF Extractor** | `stash/extract/pdf.py` | `extract_pdf_data`, `extract_pdf`, `PdfRecord` | PyMuPDF with ASCII fallback and link extraction complete. | **100% Done** |
| **Generic Web Extractor** | `stash/extract/web.py` | `extract_web_content`, `extract_web`, `WebRecord` | Title, description, readability text and link extraction complete. | **100% Done** |

### B. Storage, Indexing & Concurrency

| Component | Target File | Implemented Symbols / Features | Verification / Evidence | Status |
| --- | --- | --- | --- | --- |
| **Card Serialization** | `stash/store/cards.py` | `card_path`, `parse_card`, `render_card`, `content_hash`, `write_atomic`, `save_card` | `test_store_cards.py` proves byte-identical round-trip and hash stability. | **100% Done** |
| **Reentrant File Lock** | `stash/store/lock.py` | `write_lock`, thread-local depth tracking, 30s timeout, `LockTimeout` | `test_store_lock.py` verifies reentrancy, contention timeout, and recovery. | **100% Done** |
| **SQLite Schema & FTS5** | `stash/store/index.py` | `cards`, `sources`, `links`, `tags`, `inventory`, `rejects`, `pending`, `search` (FTS5) tables, WAL mode | `test_store_index.py` verifies WAL pragma, table creation, and rebuild. | **100% Done** |
| **Path Reindexing** | `stash/store/index.py` | `reindex_path`, `remove_path`, `rebuild`, wikilink extractor | `test_store_index.py` verifies roundtrip indexing and query restoration. | **100% Done** |
| **Sources Store** | `stash/store/sources.py` | `read_source`, `write_source`, `append_failed` | Serializes YAML frontmatter + caption body cleanly. | **100% Done** |
| **Filesystem Watcher** | `stash/store/watcher.py` | `watch`, watchfiles iterator, temp file exclusion | `test_store_watcher.py` verifies batching and temp file ignoring. | **100% Done** |

### C. CLI Subcommands Audit

The specification ([docs/link-stash-spec.md](file:///docs/link-stash-spec.md#L360-L376)) calls for 13 subcommands:

| Subcommand | Purpose | Implementation Status | File Location |
| --- | --- | --- | --- |
| `stash doctor` | Check environment, paths, tools on PATH | **Implemented** | [cli/__init__.py](file:///apps/core/src/stash/cli/__init__.py#L37) |
| `stash extract` | Extract links into sources | **Implemented** | [cli/triage.py](file:///apps/core/src/stash/cli/triage.py), service in [services/extract.py](file:///apps/core/src/stash/services/extract.py) |
| `stash analyze` | Analyze reel via LLM engines | **Implemented** | [cli/reel.py](file:///apps/core/src/stash/cli/reel.py#L26) |
| `stash ingest` | Ingest engine output from stdin/file | **Implemented** | [cli/reel.py](file:///apps/core/src/stash/cli/reel.py#L44) |
| `stash reindex` | Rebuild SQLite index from markdown | **Implemented** | [cli/store.py](file:///apps/core/src/stash/cli/store.py#L26) |
| `stash scan` | Inventory auto-rescan | **Implemented** | [cli/triage.py](file:///apps/core/src/stash/cli/triage.py), service in [services/inventory.py](file:///apps/core/src/stash/services/inventory.py) |
| `stash have` | Add manual inventory entry | **Implemented** | [cli/triage.py](file:///apps/core/src/stash/cli/triage.py), service in [services/inventory.py](file:///apps/core/src/stash/services/inventory.py) |
| `stash check` | Dedup & overlap candidate scoring | **Implemented** | [cli/triage.py](file:///apps/core/src/stash/cli/triage.py), service in [services/check.py](file:///apps/core/src/stash/services/check.py) |
| `stash save` | Atomic card save & indexing | **Implemented** | [cli/triage.py](file:///apps/core/src/stash/cli/triage.py), service in [services/cards.py](file:///apps/core/src/stash/services/cards.py) |
| `stash reject` | Record rejection in `rejected.md` | **Implemented** | [cli/triage.py](file:///apps/core/src/stash/cli/triage.py), service in [services/rejects.py](file:///apps/core/src/stash/services/rejects.py) |
| `stash pending` | List, add, resolve pending items | **Implemented** | [cli/triage.py](file:///apps/core/src/stash/cli/triage.py), service in [services/pending.py](file:///apps/core/src/stash/services/pending.py) |
| `stash serve` | FastAPI backend & static server | **Implemented** | [cli/serve.py](file:///apps/core/src/stash/cli/serve.py) |
| `stash openapi` | Output OpenAPI JSON schema | **Implemented** | [cli/serve.py](file:///apps/core/src/stash/cli/serve.py) |
| `stash install-skills` | Link skills to Claude/Antigravity | **Implemented** | [cli/triage.py](file:///apps/core/src/stash/cli/triage.py), service in [services/skills.py](file:///apps/core/src/stash/services/skills.py) |

### D. Agent Skills Audit

The specification ([docs/link-stash-spec.md](file:///docs/link-stash-spec.md#L350-L359)) requires 5 portable agent skills:

| Skill | Trigger / Command | CLI Calls Invoked | Implementation Status |
| --- | --- | --- | --- |
| **`/stash`** | Main triage workflow | `scan --if-stale`, `extract`, `analyze`/`ingest`, `check`, `save`, `reject`, `pending add` | **Complete** ([skills/stash/SKILL.md](file:///skills/stash/SKILL.md)) |
| **`/stash-init`** | Guided inventory onboarding | `have` (repeated) | **Complete** ([skills/stash-init/SKILL.md](file:///skills/stash-init/SKILL.md)) |
| **`/stash-have`** | Quick inventory insertion | `have` | **Complete** ([skills/stash-have/SKILL.md](file:///skills/stash-have/SKILL.md)) |
| **`/stash-pending`** | View & resolve DM link requests | `pending list`, `pending resolve` | **Complete** ([skills/stash-pending/SKILL.md](file:///skills/stash-pending/SKILL.md)) |
| **`/stash-scan`** | Force refresh inventory | `scan` | **Complete** ([skills/stash-scan/SKILL.md](file:///skills/stash-scan/SKILL.md)) |

---

## 5. Web Application Architecture Audit (`apps/web`)

### Implemented Components & Structure

```
apps/web/src/
├── styles/
│   ├── tokens.css               <- 100% compliant token system (light + dark, seed categories, type, radius)
│   └── tokens.test.ts           <- Automated WCAG AA contrast & token verification (24 tests)
├── components/
│   ├── CategoryPill.tsx         <- Category color badge
│   ├── GeneratedTile.tsx        <- Fallback tile with category tint & kind icon
│   ├── Tile.tsx                 <- Primary 4:5 card thumbnail tile
│   └── ui/
│       ├── button.tsx           <- Radix button primitive
│       ├── input.tsx            <- Text input primitive
│       ├── separator.tsx        <- Separator primitive
│       ├── tooltip.tsx          <- Tooltip primitive
│       ├── MorphIcon.tsx        <- Morphicons wrapper with spring physics
│       ├── SegmentedControl.tsx <- Apple-grade animated segmented switcher
│       └── StashLogo.tsx        <- SVG logo with size & responsive variants
├── state/
│   └── theme.tsx                <- React context with system preference & manual toggle
├── mock/
│   ├── mock-data.ts             <- Fixture items covering all 9 kinds
│   ├── MockCard.tsx             <- Full desktop/mobile responsive card view
│   ├── MockFeed.tsx             <- Responsive virtualized grid mock with day grouping
│   └── MockViews.tsx            <- Mocks for Sources, Pending, Rejected, Inventory, Graph
└── App.tsx                      <- Full interactive shell integrating all views with hash routing
```

### Web Milestones Status (B1–B6)

1. **B1 FastAPI Server & Client:** **Complete (100%)** (33 tests in Python).
   - FastAPI endpoints for cards, sources, state, misc, notes patcher, library cursor paging, watcher SSE events, OpenAPI TS schema and client.
2. **B2 App Shell & Live Grid:** **Complete (100%)** (85 tests in Web).
   - TanStack Router integration, AppShell, collapsible/resizable sidebar & drawer, Lenis smooth scrolling, VirtualGrid, Ctrl+K search palette, URL filters, SSE live updates.
3. **B3 Card Editing:** **Complete (100%)** (49 tests in Web, 134 total).
   - `/c/$slug` route, CardBody markdown with wikilink router links, CodeMirror 6 Notes editor with `[[` autocomplete, autosave with serialized promise queue & 409 conflict banner, PropertiesForm with ChipInput, RejectDialog, connection panels.
4. **B4 Stash Views:** **Complete (100%)** (48 tests in Web, 182 total).
   - Live HTML5 video player with seekable timestamp chips (`MM:SS`) and transcript.
   - Sources list with filters in URL (`/sources` and `/s/$sourceId`).
   - Live Pending resolution form (`POST /api/pending/{id}/resolve`).
   - Live Rejected table with quiet 404 un-reject (`DELETE /api/rejects/{key}`).
   - Live Inventory tool grouping (`groupByOrigin`) with add form (`POST /api/inventory`).
   - SVG brand logo suite (`src/components/BrandLogo.tsx`) with official SVGs from thesvg.org.
5. **B5 Graph & Backlinks:** **Complete (100%)** (29 tests across web & core).
   - sigma.js WebGL renderer + `graphology` with dynamic CSS variable color resolution via `culori`.
   - ForceAtlas2 layout executing inside a dedicated Web Worker with 2.0s auto-stop budget.
   - Local graph on `/c/$slug` with 1-hop / 2-hop switcher and isolated node overlay badge.
   - Global graph at `/graph` with edge type and category filters and node click routing.
   - Link panels on `/c/$slug` for Backlinks, Mentioned by (with platform brand logo & thumbnail), and Outgoing links (with unresolved/inventory badges).
6. **B6 Polish:** **Complete (100%)**.
   - Native View Transitions API for Tile -> Card header shared morph with `@media (prefers-reduced-motion: reduce)` override in `tokens.css`.
   - Motion `LazyMotion` + `domAnimation` layout reordering on `VirtualGrid` and `AnimatePresence` row transitions in `PendingPage` and `RejectedPage` with `useReducedMotion()` fallback.
   - Spring physics `MorphIcon` wrapping Hugeicons (Play ↔ Pause, Sun ↔ Moon).
   - Dependency-free `TextMorph` (torph) for sidebar counts and PageHeader title transitions with `respectReducedMotion`.
   - Dedicated keyboard-accessible `ThemeToggle` with visible focus rings.
   - All 4 quality gates verified: responsive, keyboard-only, WCAG AA contrast (`tokens.test.ts`), and bundle budget (`scripts/check-bundle.mjs` verifying 131.5 KB gzip <= 250 KB budget).

---

## 6. Dependencies & Toolchain Status

### Python Environment (`apps/core/pyproject.toml`)

- **Installed & Verified:** `typer`, `pydantic`, `httpx`, `scrapling[fetchers]`, `watchfiles`, `pyyaml`, `pymupdf`, `huggingface-hub`, `rapidfuzz`, `fastapi`, `uvicorn`, `tomlkit`, `pytest`, `ruff`, `pyright`.
- **Missing Dependencies to Add:**
  - `google-genai` (not in `pyproject.toml`; required for live Gemini API reel analysis).
  - `faster-whisper` is an optional `[whisper]` extra, off by default.

### Node.js Environment (`apps/web/package.json`)

- **Installed & Verified:** React 19, Vite 8, Tailwind CSS v4, `@fontsource-variable/geist`, `@hugeicons/react`, `radix-ui`, `morphicons`, `culori`, Vitest 5, ESLint 10, Prettier.
- **Already added:** `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/react-virtual`, `openapi-fetch`, `openapi-typescript` (dev), `lenis`.
- **Dependencies to Add for B3–B6:**
  - `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`, `@codemirror/autocomplete`
  - `react-markdown`
  - `sigma`, `graphology`, `graphology-layout-forceatlas2`
  - `motion`

### Monorepo & Pre-commit Hooks

- Root `package.json` with Husky + `lint-staged` is not yet configured.
- Recommended to configure Husky running `ruff check` on staged `.py` and `eslint` on staged `.tsx`.

---

## 7. Immediate Next Steps & Critical Path

Done Oct 6: every spec CLI subcommand registered (`cli/triage.py`); A9 fallbacks (frames handoff, optional whisper, manual mp4, blocked pending).

1. **A10 First Real Run:** `stash install-skills`, `/stash-init`, then `/stash` on pasted links. Fix what breaks.
2. **B2 Shell, Grid, Search:** replace the B0 mock shell with TanStack Router + Query against `stash serve`.
3. **Housekeeping:** add `google-genai` to `pyproject.toml`; root Husky + lint-staged.
