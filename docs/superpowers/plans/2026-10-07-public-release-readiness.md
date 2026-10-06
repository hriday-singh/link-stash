# Link Stash Public Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Link Stash codebase into an accessible, production-grade, public open-source project with clean workspace hygiene, simplified CLI ergonomics, complete open-source documentation, and release readiness.

**Architecture:** Monorepo with `apps/core` (Python 3.14 via uv), `apps/web` (React 19 / Vite SPA), and `skills/` (agent skills). The plan establishes root-level command delegation, adds project licensing and community templates, eliminates binary clutter, and provides comprehensive public documentation.

**Tech Stack:** Python 3.14, uv, Typer, FastAPI, React 19, Vite 8, Tailwind CSS v4, TanStack Router/Query/Virtual, Sigma.js, pnpm monorepo.

**Spec:** [docs/link-stash-spec.md](file:///C:/Users/clash/OneDrive/Desktop/Codes/Tools/stash/docs/link-stash-spec.md) and [docs/library-app-spec.md](file:///C:/Users/clash/OneDrive/Desktop/Codes/Tools/stash/docs/library-app-spec.md).

## Global Constraints
- Never commit code changes directly; leave commits to the user.
- Strictly adhere to zero hardcoded tokens / styles.
- Preserve 100% test coverage and strict type safety across both Python and TypeScript.
- No single source file exceeding 700 lines.

---

## 1. Public Readiness Audit & Assessment

A thorough diagnostic audit was conducted on the current codebase:

| Check | Current Status | Public Readiness Assessment |
| --- | --- | --- |
| **Automated Tests** | 466 tests passing (241 Python, 225 Web) | **PASSED** (100% pass rate) |
| **Type Checking** | Pyright strict (0 errors), `tsc -b` (0 errors) | **PASSED** |
| **Linting & Code Quality** | Ruff (0 errors), ESLint (0 errors, 17 warnings) | **PASSED** |
| **Bundle Budget** | 131.47 KB gzip initial bundle (< 250 KB budget) | **PASSED** |
| **Secrets & Credentials** | Clean. Only `.env.example` committed. No API keys found. | **PASSED** |
| **License** | Missing `LICENSE` file at repository root. | **ACTION REQUIRED** |
| **Workspace Hygiene** | 8.7MB of temporary mp4s, scratch JSONs, expired script `files.ps1` at root. | **ACTION REQUIRED** |
| **Clone Reproducibility** | `test_reel_live.py` asserts root test mp4s exist (fails on fresh clone). | **ACTION REQUIRED** |
| **CLI Ergonomics** | CLI requires `uv run --directory apps/core stash` or global tool install. | **ACTION REQUIRED** |
| **Documentation** | Needs simplified quickstart, architecture diagram, command cheat-sheet. | **ACTION REQUIRED** |
| **Community Standards** | Missing `CONTRIBUTING.md`, `CHANGELOG.md`, issue/PR templates. | **ACTION REQUIRED** |
| **Version Alignment** | `apps/core` is 0.1.0, `apps/web` is 0.0.0, root has no version. | **ACTION REQUIRED** |

---

## User Review Required

> [!IMPORTANT]
> **Root Clutter Deletion**: We propose deleting `files.ps1` (expired Instagram CDN links), `.playwright-mcp/`, root `.pytest_cache/`, and cleaning up the 8.7MB temporary video files (`reel1.mp4`, `reel2.mp4`, `reel3.mp4`) and scratch benchmark files (`results-*-round1.json`). In `apps/core/tests/live/test_reel_live.py`, tests will skip gracefully if reels are absent so fresh clones pass.

> [!NOTE]
> **Release Recommendation**: We recommend releasing version **`0.1.0`** (Initial Public Preview). We will align versions across `package.json`, `apps/web/package.json`, and `apps/core/pyproject.toml`, and author a comprehensive `CHANGELOG.md`.

---

## Open Questions

1. **Test Reel Videos**: Would you like us to delete `reel1.mp4`, `reel2.mp4`, and `reel3.mp4` from the repository root entirely, or move them into a dedicated ignored fixture directory (e.g. `tests/fixtures/sample_reels/`)?
2. **Author Identity**: In `apps/core/pyproject.toml`, the author is configured as `Hriday Singh <hridaysingh2207@gmail.com>`. Is this the exact name and contact email you wish to publish publicly in the MIT License and package metadata?
3. **CLI Invocation Preference**: We plan to add `pnpm stash <cmd>` in root `package.json` plus portable root scripts (`./stash` for bash, `stash.cmd` for Windows cmd, `stash.ps1` for PowerShell) so you can run `./stash <cmd>` directly from anywhere in the repository. Does this fit your workflow?

---

## Proposed Changes

### Component 1: Workspace Hygiene & Test Resilience

#### [DELETE] `files.ps1`
Delete the scratch download script containing expired Oct 5 CDN URLs.

#### [DELETE] `.playwright-mcp/` and root `.pytest_cache/`
Remove untracked test caches from the root workspace.

#### [MODIFY] `apps/core/tests/live/test_reel_live.py`
Make live integration tests resilient so contributors on clean git clones can run tests without failing on missing binary sample reels.

```python
@pytest.mark.live
def test_live_oct5_reels_exist():
    """Verify sample reels if present; skip gracefully on clean public clones."""
    reels = ["reel1.mp4", "reel2.mp4", "reel3.mp4"]
    missing = [r for r in reels if not (REPO_ROOT / r).is_file()]
    if missing:
        pytest.skip(f"Sample test reels not present at repo root ({', '.join(missing)})")
    for reel_name in reels:
        reel_path = REPO_ROOT / reel_name
        assert reel_path.stat().st_size > 0
```

---

### Component 2: Licensing & Legal

#### [NEW] `LICENSE`
Create standard MIT License file at the root of the repository.

```text
MIT License

Copyright (c) 2026 Hriday Singh

Permission is hereby granted, free of charge, to any person obtaining a copy
...
```

---

### Component 3: CLI Ergonomics & Root Monorepo Scripts

#### [MODIFY] `package.json`
Add root scripts for instant CLI access and one-step setup:
- `"version": "0.1.0"`
- `"stash": "uv run --directory apps/core stash"`
- `"setup": "pnpm install && uv sync --directory apps/core && pnpm stash install-skills --workspace"`
- `"doctor": "pnpm stash doctor"`
- `"scan": "pnpm stash scan"`
- `"serve": "pnpm dev:api"`
- `"skills:install": "pnpm stash install-skills --workspace"`

#### [MODIFY] `apps/web/package.json`
Bump version from `"0.0.0"` to `"0.1.0"` to keep package versions consistent across the monorepo.

#### [NEW] `stash` (Executable Bash Wrapper for Linux / macOS / Git Bash)
Enables `./stash doctor` or `./stash suggest` from the terminal root.

```bash
#!/usr/bin/env bash
exec uv run --directory apps/core stash "$@"
```

#### [NEW] `stash.cmd` (Windows Command Prompt Wrapper)
Enables `stash doctor` or `stash suggest` directly in Windows Command Prompt.

```cmd
@echo off
uv run --directory apps\core stash %*
```

#### [NEW] `stash.ps1` (PowerShell Wrapper)
Enables `.\stash doctor` or `.\stash suggest` directly in PowerShell.

```powershell
uv run --directory apps/core stash @args
```

---

### Component 4: Documentation Overhaul

#### [MODIFY] `README.md`
Upgrade `README.md` to a modern, public-facing showcase:
- Hero banner with badges (License MIT, Python 3.14, React 19, Tests 466 Passing).
- Crystal-clear 3-step Quickstart:
  1. `pnpm setup`
  2. `pnpm dev`
  3. Explore at `http://localhost:5173`
- Visual Architecture & Flow diagram (Mermaid diagram showing Scrapling -> Reel Engines -> Markdown Store / FTS5 SQLite -> FastAPI -> React SPA).
- Comprehensive CLI Command Matrix (all 15 subcommands with clear examples).
- Agent Skills Guide (Claude Code & Antigravity integration).
- Configuration Reference (`config.toml` & `.env`).
- FAQ & Troubleshooting (`ffmpeg`, `agy` vs Gemini API, Python 3.14).

#### [NEW] `CONTRIBUTING.md`
Create a comprehensive guide for external contributors:
- Environment setup (`uv`, `pnpm`, `ffmpeg`).
- Architecture breakdown (`apps/core`, `apps/web`, `skills/`).
- Running test suites (`pnpm test`, `pnpm test:core`, `pnpm test:web`).
- Quality gates (`pnpm lint`, `pnpm typecheck`, `pnpm check:bundle`).
- Commit conventions (`feat:`, `fix:`, `docs:`, etc.).
- Pull request guidelines.

#### [NEW] `CHANGELOG.md`
Create Keep-a-Changelog document featuring the initial `0.1.0` release:
- Core Pipeline features (Universal scraping via Scrapling, multi-engine reel understanding, FTS5 search index, atomic markdown cards, inventory scanning, suggest engine).
- Web features (React 19 / Vite SPA, virtualized feed, CodeMirror notes editor, Sigma.js WebGL graph, HTML5 video player with seekable timestamp chips).
- Portable Agent Skills (`/stash`, `/stash-suggest`, `/stash-init`, `/stash-have`, `/stash-scan`, `/stash-pending`).

---

### Component 5: GitHub Community Standards

#### [NEW] `.github/ISSUE_TEMPLATE/bug_report.md`
Structured bug report template with system info (`stash doctor` output), reproduction steps, and expected behavior.

#### [NEW] `.github/ISSUE_TEMPLATE/feature_request.md`
Structured feature request template with problem description, proposed solution, and alternatives considered.

#### [NEW] `.github/PULL_REQUEST_TEMPLATE.md`
Standard PR template with checklist (tests pass, lint/typecheck clean, bundle budget maintained).

---

## Verification Plan

### Automated Tests
1. **Root scripts verification:**
   - `pnpm stash doctor` -> exits 0 with JSON system status.
   - `pnpm stash --help` -> displays clean Typer command help.
   - `pnpm stash suggest "web scraper" --text` -> returns structured suggestions.
2. **Wrapper execution:**
   - `.\stash.ps1 doctor` -> exits 0 with status.
3. **Full test suite:**
   - `pnpm test:core` -> 241 passed.
   - `pnpm test:web` -> 225 passed.
   - `pnpm test` -> 466 passed.
4. **Linters & Typecheck:**
   - `pnpm lint` -> 0 errors.
   - `pnpm typecheck` -> 0 errors across Python (Pyright strict) and TypeScript (`tsc -b`).
5. **Production Build & Bundle Size:**
   - `pnpm build` -> static build succeeds in `apps/web/dist`.
   - `pnpm check:bundle` -> initial bundle < 250 KB gzip budget.

### Manual Verification
1. Verify `LICENSE` file displays proper copyright and license terms.
2. Verify `README.md` renders beautifully with valid links, diagrams, and formatting.
3. Verify that running `stash serve` serves both API and static production frontend on `http://127.0.0.1:8765`.
