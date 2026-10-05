# A3 Reel Engines: Plan

**Goal:** `stash analyze <id> [--engine ...]` and `stash ingest <id> <file|->` turn a downloaded reel into a structured, validated `ReelRecord` (summary, transcript, mentions, features, takeaways, CTA) cached by source ID, with multi-engine fallback (`agy` headless -> `gemini_api` -> `frames`).
**Spec:** `docs/link-stash-spec.md` (Reel understanding, Engine by host, Input to every engine, Output schema, Mention rules, Oct 5 test, Build order A3, Open questions). Contract: `SourceDoc` / `reel.json`.
**Stack adds:** `google-genai` (Gemini 3.8 Flash SDK), `pyyaml` (source frontmatter), `pydantic` v2, system `ffmpeg`.

## Constraints
- Does not modify A2 files currently in progress (`extract/instagram.py`, `services/extract.py`). Consumes the source directory structure (`library/sources/<source-id>/`) and `SourceDoc` contract.
- Caching: Output written to `sources/<id>/raw.json` and stage updated to `analyzed`. Subsequent runs return cached data immediately without invoking an engine.
- Strict mention rules in `prompt.md`: mentions must be standalone installable/usable items; features/settings stay under `features`; benchmarks stay in `takeaways`; self-derived URLs get `url_source: inferred`.
- Antigravity agent in-session opens `video.mp4` directly and pipes JSON via `stash ingest <id> -`.
- Headless runs (e.g. from Claude Code or automated scripts) run `stash analyze <id>`, which steps through `config.reel_engines` (`agy`, `gemini_api`, `frames`).
- Never commit; checkpoint after each task.

## Review focus
1. **Schema compliance:** Output matches `reel.json` with strict types and valid enums (`kind` in repo/model/skill/plugin/mcp/tool/ui_ref/link; `url_source`, `evidence`, `engine`).
2. **Mention vs Feature separation:** Features of a tool (e.g. Dependabot on gh-secure) are nested in `features[name]`, not emitted as separate root mentions.
3. **Engine fallback chain:** When `agy` fails or times out (5 min), `gemini_api` takes over seamlessly.
4. **Gemini video handling:** Videos < 20 MB sent inline; videos >= 20 MB uploaded via the Files API and waited on until ACTIVE.
5. **Idempotent caching:** A reel with existing `raw.json` and `stage >= analyzed` returns instantly without LLM or subprocess calls.
6. **Graceful error logging:** Missing tool, missing API key, or unparseable video logs structured error and falls back to next engine.

---

### Task 1: Prompt, Schema, and Pydantic Models
- **Files:** `apps/core/src/stash/reel/prompt.md`, `apps/core/src/stash/reel/schemas/reel.json`, `apps/core/src/stash/reel/models.py`, `apps/core/tests/test_reel_models.py`.
- **Approach:**
  - Create `schemas/reel.json` matching the spec's exact schema.
  - Create `models.py` with Pydantic v2 models: `ReelMention`, `ReelCta`, `ReelRecord`.
  - Create `prompt.md` containing the shared system prompt, mention rules, feature rules, takeaway guidelines, and output formatting.
  - Tests validate `results-agy-round1.json` fixtures against `ReelRecord` and test validation failures on bad enums / missing fields.

### Task 2: Antigravity Headless Engine (`agy`)
- **Files:** `apps/core/src/stash/reel/agy.py`, `apps/core/tests/test_reel_agy.py`.
- **Approach:**
  - `run_agy_headless(source_dir: Path, prompt_text: str, timeout: int = 300) -> ReelRecord`:
    - Checks `shutil.which("agy")`. If missing, raises `ReelEngineError("agy not found on PATH")`.
    - Spawns `agy -p "<prompt>" --output-format json --json-schema schemas/reel.json --print-timeout 5m` inside `source_dir`.
    - Reads `.structured_output` or parses stdout JSON into `ReelRecord`.
    - Sets `engine="agy-headless"`.
- **Tests:** Mock `subprocess.run`: success with `.structured_output`, fallback to stdout JSON, schema error, process timeout, missing binary.

### Task 3: Gemini API Engine (`gemini_api`)
- **Files:** `apps/core/src/stash/reel/gemini_api.py`, `apps/core/tests/test_reel_gemini.py`.
- **Approach:**
  - `run_gemini_api(video_path: Path, caption: str | None, creator: str | None, prompt_text: str, api_key: str | None = None) -> ReelRecord`:
    - Uses `google-genai` client with `gemini-3.8-flash`.
    - Resolves API key from arg, `GEMINI_API_KEY` env, or `.env`. If missing, raises `ReelEngineError("GEMINI_API_KEY missing")`.
    - If video file size < 20 MB: pass file bytes inline with `mime_type="video/mp4"` and `media_resolution="high"`.
    - If video file size >= 20 MB: upload via `client.files.upload` and poll until `ACTIVE`.
    - Pass prompt, caption, creator handle, and `response_schema=ReelRecord`.
    - Sets `engine="gemini-api"`.
- **Tests:** Mock `google-genai` client: small file inline payload, large file upload & poll, missing key, API quota 429 error.

### Task 4: Frames Fallback Engine Draft (`frames`)
- **Files:** `apps/core/src/stash/reel/frames.py`, `apps/core/tests/test_reel_frames.py`.
- **Approach:**
  - `generate_contact_sheet(video_path: Path, output_path: Path, max_frames: int = 12) -> Path`:
    - Calls `ffmpeg` to extract scene change frames (`select='gt(scene,0.3)'`) or uniform interval frames if scene count < 3.
    - Uses `drawtext` or tile filter to lay out up to 12 timestamped frames into a single `contact.jpg`.
  - Serves as the visual preparation step when both LLM video engines are unavailable.
- **Tests:** Mock `ffmpeg` subprocess calls; verify command arguments, tile filter syntax, and output file handling.

### Task 5: Reel Service & Ingestion
- **Files:** `apps/core/src/stash/services/reel.py`, `apps/core/tests/test_reel_service.py`.
- **Approach:**
  - `analyze_reel(home: Path, source_id: str, engine: str | None = None) -> ReelRecord`:
    - Resolves source directory `home/library/sources/<source-id>`.
    - Checks cache: if `raw.json` exists and represents an analyzed reel, loads and returns it.
    - Reads `video.mp4` and caption/creator from `source.md` (or `raw.json`).
    - Engine sequence: if `engine` given, run only that engine; otherwise iterate through `cfg.reel_engines` (`["agy", "gemini_api", "frames"]`).
    - On success: saves output to `raw.json`, updates `source.md` frontmatter stage to `analyzed` (and fills summary, mentions, transcript, cta), and returns `ReelRecord`.
  - `ingest_reel(home: Path, source_id: str, raw_json_text: str) -> ReelRecord`:
    - Validates text into `ReelRecord`, sets `engine="agy-host"`, writes `raw.json`, and updates `source.md`.
- **Tests:** Cache hit bypasses engines; engine fallback succeeds when first fails; all engines failing raises `StashError`; `ingest_reel` validates and writes atomically.

### Task 6: CLI `stash analyze` and `stash ingest`
- **Files:** `apps/core/src/stash/cli/reel.py` (or subcommands in `cli/__init__.py`), `apps/core/tests/test_cli_reel.py`.
- **Approach:**
  - `stash analyze <source_id> [--engine <engine>]`: runs `analyze_reel`, prints JSON to stdout. Exits 2 on `StashError`.
  - `stash ingest <source_id> <file_or_dash>`: if argument is `-`, reads from stdin; otherwise reads file. Runs `ingest_reel`, prints JSON to stdout.
- **Tests:** CLI tests with runner: analyze runs with mock service; ingest handles file path; ingest handles piped stdin (`-`); invalid input produces structured error shape on stderr.

### Task 7: Verification against Oct 5 Test Reels (Live Test)
- **Files:** `apps/core/tests/live/test_reel_live.py`.
- **Approach:**
  - Run `analyze_reel` on the sample reels (`reel1.mp4` gh-secure, `reel2.mp4` HydraFusion, `reel3.mp4` Sonnet 5.5).
  - Verify mentions match ground truth (`results-agy-round1.json`):
    - `reel1.mp4`: `gh-secure` tool extracted; Dependabot / branch protection listed as features, not top-level mentions.
    - `reel2.mp4`: `HydraFusion` extracted; 67% cost / benchmarks placed in takeaways.
    - `reel3.mp4`: caption-only details (Claude Haiku 5.5, URL) captured.
  - Confirm agy in-session ingest and agy headless produce matching mentions.
- **Done:** unit tests, ruff, pyright green; test reels produce expected structured output.
