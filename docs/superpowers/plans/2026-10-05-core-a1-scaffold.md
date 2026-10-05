# A1 Core Scaffold: Plan

**Goal:** `apps/core` uv project with the `stash` package, config loading, error types, a `stash doctor` command, CI.
**Spec:** `docs/link-stash-spec.md` (Repo layout, Build order A1). Contract names: `2026-10-05-library-app-00-overview.md`.
**Stack:** Python 3.14 via uv, Typer, Pydantic v2, stdlib `tomllib`, pytest, ruff, pyright strict.

## Constraints
- Names match the core contract exactly (`stash.config.Config`, `load_config`, `stash.errors.*`, `stash.cli:app`).
- `cli/` stays thin: parse args, call a function, print JSON.
- Never commit; the end of each task is a checkpoint.
- `apps/web` untouched (B0 runs in parallel). Husky + lint-staged need a root `package.json`, so they wait until B0 is done.

## Review focus
1. `STASH_HOME` unset, set, and pointing at a missing folder.
2. Bad `config.toml` (syntax error, wrong type) gives `Invalid` with the file path, not a traceback.
3. `--json` errors use `{"error": {"code", "message", "details"}}`.
4. Windows paths: `~` expansion, backslashes.

---

### Task 1: uv project
- **Files:** `apps/core/pyproject.toml`, `apps/core/src/stash/__init__.py`, `apps/core/.gitignore`.
- **Approach:** `uv init --package`, `requires-python >= 3.14`, deps `typer`, `pydantic`; dev group `pytest`, `ruff`, `pyright`. Entry point `stash = "stash.cli:app"`. Ruff (lint + format) and pyright strict configured in `pyproject.toml`.

### Task 2: Errors and config
- **Files:** `src/stash/errors.py`, `src/stash/config.py`, `tests/test_config.py`.
- **Approach:** `StashError(code, message, details)` with `to_dict()` giving the shared error shape; `NotFound`, `Conflict`, `Invalid`, `LockTimeout`. `Config` per the contract; `load_config(home=None)` resolves `home` arg, then `STASH_HOME`, then `~/stash`; reads `config.toml` if present via `tomllib`; validation errors become `Invalid` with the path.
- **Tests:** home resolution order; missing config file gives defaults; values from toml; bad toml and wrong types raise `Invalid`.

### Task 3: CLI + doctor
- **Files:** `src/stash/cli/__init__.py`, `tests/test_cli.py`.
- **Approach:** Typer `app`. `stash doctor` prints JSON: resolved home, whether it exists, and `ffmpeg`/`agy`/`gh` paths (`shutil.which`). Exits 1 if a tool is missing. A `StashError` prints the error shape on stderr and exits 2.
- **Tests:** `--help` runs; doctor JSON with tools mocked present and missing; bad config gives exit 2 + error JSON.

### Task 4: Root files + CI
- **Files:** `config.example.toml`, `.env.example`, `.github/workflows/ci.yml`.
- **Approach:** Example config lists every key the spec names, commented. CI: `core` job on windows + ubuntu (`uv sync`, ruff check, ruff format --check, pyright, pytest); `web` job on ubuntu (pnpm install, lint, typecheck, test, build).
- **Done:** `uv run stash --help` works in PowerShell and Git Bash; ruff, pyright, pytest green locally. CI green needs a push (you).
