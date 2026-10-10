# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow `MAJOR.MINOR.PATCH.BUILD` (PEP 440). `pnpm setup` prints every entry added since your last setup.

## [Unreleased]

### Added
- `/stash-feedback` skill: run after `/stash` in the same session; the agent reviews its own run (friction, confusing skill lines, human-in-the-loop waits, proposed skill/CLI changes), saves it to `<stash home>/feedback/` and prints it for copy-paste. Delete a file once addressed.
- Preference learning: `stash save` / `stash reject` take `--proposed` (and `--proposed-bucket`, `--reason`; per-card fields in batch JSON) and log proposed vs final to `library/decisions.jsonl`. `stash prefs` summarizes the log (overrides, per-category counts, liked tags) and returns `library/preferences.md`; `--seed` adds a library summary for the first rules. `/stash` applies the rules to proposals (tagged `pattern:` in the review table) and updates them after runs with overrides.
- `stash suggest` nudges `try-now`/`upgrade` cards and cards with liked tags up by at most two places; cards now include `bucket`.
- `stash reject` takes `--source` (moves the post to stage `triaged`, like save) and a JSON array via `-` or a file for batch rejects.

### Changed
- `stash analyze` frames fallback summary names why each engine failed and whether a transcript exists (`whisper off` by default).
- `/stash` skill: review tables are printed before any multiple-choice prompt; carousel slides are read from images (no OCR); no `stash config`, rules live at `rules_path`.
- `/stash` skill: a missing license (`no_license`) is listed in `Pricing` as `no license found` and no longer turns a row into `ask`; detection misses too often to block on.
- `pnpm setup` now runs `pnpm build`, so `stash serve` picks up web UI changes.
- Sources page: `Copy /stash (N)` button copies one `/stash <links>` command for every source the current filters show (e.g. stage New), to send them all through triage.
- Rejected page: un-reject toasts a copyable `/stash <link>` command to save the card again (rejecting deletes the card, so un-reject alone does not restore it).

## [1.0.0.11] - 2026-10-10

### Added
- `pnpm setup` now prints changelog entries since the last setup and records the version in `.stash-version`.
- `stash --version` / `stash -v` prints the installed version; `stash doctor` includes it.
- `pnpm setup` installs/refreshes the global `stash` command (`uv tool install --force --editable apps/core`); run it alone with `pnpm tool:install`.
- `stash check` and `stash save` accept multiple items in one call (batch triage).
- `stash ingest --template` prints the ingest JSON schema.
- Repository statistics page (`pnpm stats`) with charts and KPIs.

### Changed
- Version is read from `apps/core/pyproject.toml` everywhere (API `/api/meta`, OpenAPI spec).
- Stash skill: batch extraction without mid-stream pauses, smarter carousel/CTA handling, denser review table.

### Fixed
- Card search rows no longer deleted when a source shares the same key (`stash suggest` now finds them).
- Windows `ig:ID` style keys normalized to valid source directories.

## [0.1.0] - 2026-10-07

### Added

#### Core Pipeline (`apps/core`)
- **Universal Link Extraction**: Universal web and social content extraction powered by Scrapling (`Fetcher` and `StealthyFetcher` with automatic Cloudflare/anti-bot challenge handling).
  - Instagram reels (audio, OCR, poster thumbnails, video metadata, CTA keywords).
  - GitHub repositories (API + scrape backends, star counts, license, skills/MCP detection).
  - Hugging Face models and spaces (Hub API + scrape backend with GGUF variants).
  - Notion pages & PDFs (dynamic headless DOM rendering and PyMuPDF text/link parsing).
  - Generic web pages & documentation articles.
- **Reel Understanding & Transcription Engines**:
  - Headless Antigravity (`agy`) vision/audio engine.
  - Google Gemini API (`gemini_api`) with inline and large-file upload streaming.
  - Local frames contact-sheet generator with optional faster-whisper speech transcription.
- **Atomic Markdown Storage & FTS5 SQLite Index**:
  - Byte-identical markdown card serialization with YAML frontmatter.
  - Reentrant in-process file write locking with configurable timeouts.
  - SQLite WAL mode index with FTS5 full-text search across titles, summaries, wikilinks, tags, inventory, and rejected records.
  - Real-time filesystem watcher (`watchfiles`) with instant index reconciliation.
- **Inventory & Triage Services**:
  - Automatic host environment scanners for Claude Code, Antigravity plugins, Codex, Qwen, system dev tools, Ollama models, LM Studio cache, and Hugging Face cache.
  - 24-hour cache freshness validation.
  - Deduplication and fuzzy candidate overlap matching via RapidFuzz.
  - Suggestion engine (`stash suggest`) partitioned across installed tools, library cards, and workflow practices.
- **Portable Agent Skills**:
  - Pre-packaged skills for Claude Code and Antigravity: `/stash`, `/stash-suggest`, `/stash-init`, `/stash-have`, `/stash-scan`, `/stash-pending`.
  - Junction/symlink installer (`stash install-skills`).
- **Command-Line Interface**:
  - Complete Typer CLI with 15 commands: `doctor`, `extract`, `analyze`, `ingest`, `reindex`, `scan`, `have`, `check`, `save`, `reject`, `pending`, `suggest`, `serve`, `openapi`, and `install-skills`.
  - Root convenience runners (`pnpm stash`, `./stash`, `stash.cmd`, `stash.ps1`).

#### Library Web Application (`apps/web`)
- **Modern Local Single-Page App**:
  - Built with React 19, Vite 8, and Tailwind CSS v4.
  - Strict zero-hardcoded-token design system (`tokens.css`) with 100% WCAG AA contrast compliance and system/dark/light mode switching.
- **Feed & Card Exploration**:
  - Virtualized responsive card grid with TanStack Virtual and Lenis smooth scrolling.
  - Global Ctrl+K command palette and real-time FTS search with snippet highlighting.
  - Interactive card detail view (`/c/$slug`) with bidirectional wikilinks (`[[slug]]`), category color tags, and external link panels.
- **Conflict-Safe Card Editing**:
  - CodeMirror 6 markdown Notes editor with `[[` wikilink autocomplete and autosave.
  - HTTP 409 conflict detection banner with three-way diff resolution.
- **Interactive Graph Visualization**:
  - Sigma.js WebGL graph renderer with Graphology.
  - Off-thread ForceAtlas2 layout calculation inside a dedicated Web Worker (2.0s stop budget).
  - Local 1-hop and 2-hop neighborhood inspection on card pages.
  - Full-screen global knowledge graph (`/graph`) with category and edge type filtering.
- **Video & Media Player**:
  - HTML5 video player with range-request streaming.
  - Interactive transcript chips with seekable `MM:SS` timestamps.
- **Stash Management Views**:
  - Sources feed (`/sources`) and detail viewer (`/s/$sourceId`).
  - Pending items resolver (`/pending`) for comment-for-link and DM-gated downloads.
  - Rejected log (`/rejected`) with quiet un-reject capability.
  - Inventory grouped overview (`/inventory`) with manual tool entry forms.
- **Performance & Polish**:
  - Optimized bundle splitting with initial entry chunk under 132 KB gzip (well within the 250 KB budget).
  - Motion layout animations with `prefers-reduced-motion` compliance.
