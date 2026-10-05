# Link Stash Core Pipeline: Plan Overview (A1–A7)

**Spec:** [docs/link-stash-spec.md](../../link-stash-spec.md) (part 1). Web app spec: [docs/library-app-spec.md](../../library-app-spec.md) (part 2).
**Web app overview:** [2026-10-05-library-app-00-overview.md](2026-10-05-library-app-00-overview.md) (B0–B6).

Seven core plans, one per milestone. Each milestone ships working, independently testable software.

| Plan | Milestone | Ships | Gate |
| --- | --- | --- | --- |
| [a1-scaffold](2026-10-05-core-a1-scaffold.md) | A1 Scaffold | `apps/core` uv project, `stash` package, `Config`, errors, `stash doctor`, CI | `stash --help` runs in PowerShell/Bash; CI green |
| [a2-instagram](2026-10-05-core-a2-instagram.md) | A2 Instagram extractor | Scrapling embed fetch, mp4 + thumb download, carousel items, resumable stages, `failed.jsonl` | 20 test links yield 20 records and media; resume re-runs cleanly |
| [a3-reel-engines](2026-10-05-core-a3-reel-engines.md) | A3 Reel engines | `stash analyze`, `stash ingest`, prompt + `reel.json`, `agy` headless, `gemini_api`, `frames` | Test reels produce matching structured output across engines |
| [a4-store-index](2026-10-05-core-a4-store-index.md) | A4 Store and index | Markdown card read/write, reentrant lock, SQLite index with FTS5, `stash reindex`, watcher | Cards round-trip byte-identical; deleting DB + reindex restores queries |
| [a5-other-extractors](2026-10-05-core-a5-other-extractors.md) | A5 Other extractors | GitHub (API + scrape), Hugging Face, Notion, PDF, generic web, 1-level follow-through | 3 passing sample links per extractor type |
| [a6-inventory](2026-10-05-core-a6-inventory.md) | A6 Inventory | Agent tool scanners (Claude, Antigravity, Codex, etc.), local models (Ollama, LM Studio, HF cache), `stash scan`, `stash have` | Real installed tools and models listed in SQLite `inventory` table |
| [a7-triage-save](2026-10-05-core-a7-triage-save.md) | A7 Check, save, queue | `stash check` (exact + RapidFuzz overlap), `stash save`, rejects, pending, `stash import-ig-export` | Re-pasted links report duplicate; export fills queue; unlocks B1 |

---

## Progress & Status (Oct 5, 2026)

- **A1 Scaffold:** Completed and committed in `1f40ee7`.
- **A2 Instagram Extractor:** Active in background process.
- **A3–A7 Plans:** Fully drafted, reviewed against `link-stash-spec.md`, and ready for execution.
- **Precondition for B1:** Completing A4 (Store & Index) and A7 (Check & Save) delivers the core contract consumed by the FastAPI web server (`stash serve`).
