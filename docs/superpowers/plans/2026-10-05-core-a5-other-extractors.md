# A5 Other Extractors: Plan

**Goal:** Extend `stash extract <url...>` to support GitHub repos, Hugging Face assets, Notion pages, PDFs, and generic web pages, with one-level follow-through extraction for mentioned links.
**Spec:** `docs/link-stash-spec.md` (Source extractors, GitHub backends, Follow-through, Identity keys, Build order A5).
**Stack adds:** `huggingface_hub`, `PyMuPDF` (`fitz`), `scrapling[fetchers]`, `httpx`.

## Constraints
- Does not modify A2 Instagram extractor logic (`extract/instagram.py`). Adds sibling extractors under `src/stash/extract/`.
- Offline unit tests: All parsing operates on recorded fixtures (saved HTML/JSON), never making real network calls in default test suite.
- Live tests placed in `tests/live/` marked `@pytest.mark.live`.
- Dual GitHub backends: API backend (when `gh auth token` or `GITHUB_TOKEN` is found) and scrape backend (Scrapling + raw.githubusercontent.com); both produce identical `SourceDoc` / `raw.json` records.
- Follow-through: Automatically extracts child GitHub/HF links mentioned in the primary source up to 1 level deep.
- Never commit; checkpoint after each task.

## Review focus
1. **GitHub backend parity:** API and scrape backends produce identical key fields for the same repo (canonical owner/repo, stars, license, skill/mcp presence).
2. **GitHub rename handling:** A renamed repo (e.g. 301 redirect or API canonical name) normalizes to the canonical identity key.
3. **Hugging Face metadata extraction:** Accurately extracts parameter counts from safetensors metadata and detects GGUF quantizations.
4. **Notion page parsing:** Extracts main markdown text and collects all outbound URLs without breaking on nested blocks.
5. **PDF text & link extraction:** Fast PyMuPDF text extraction and embedded hyperlink discovery.
6. **One-level follow-through:** Discovered links added to batch without infinite recursion.

---

### Task 1: GitHub Extractor (Universal Scrapling & API Dual Backend)
- **Files:** `apps/core/src/stash/extract/github.py`, `apps/core/tests/fixtures/github/*`, `apps/core/tests/test_extract_github.py`.
- **Approach:**
  - Scrape Backend (`Scrapling`): Universal scraper using Scrapling `Fetcher` / `StealthyFetcher` to fetch and parse `github.com/<owner>/<repo>` for star count (exact integer from `title`), description, topics, license, files, and canonical name redirects; probes raw files via Scrapling.
  - API Backend (`httpx`): Companion backend when `gh auth token` or `GITHUB_TOKEN` is found. `GET /repos/{owner}/{repo}`, `/readme`, `/git/trees/HEAD?recursive=1`. Detects `SKILL.md`, `.claude-plugin/plugin.json`, `mcp` configs.
  - Records which backend was used in `raw.json["backend"]`.
- **Tests:** Recorded fixtures: standard repo, renamed repo, repo with SKILL.md, repo with MCP server; assert both backends produce matching records.

### Task 2: Hugging Face Extractor (Scrapling & Hub Integration)
- **Files:** `apps/core/src/stash/extract/hf.py`, `apps/core/tests/fixtures/hf/*`, `apps/core/tests/test_extract_hf.py`.
- **Approach:**
  - Key normalization: `hf:model:<org>/<name>`, `hf:dataset:<org>/<name>`, `hf:space:<org>/<name>`.
  - Scrapling Page Fetch: Uses Scrapling `Fetcher` / `StealthyFetcher` on `huggingface.co/<org>/<name>` to scrape model card README, parameters, license, tags, and detect `.gguf` quantizations directly from page DOM and file trees.
  - Hub API Integration: Complementary metadata from `huggingface_hub.HfApi().model_info(...)` when available.
- **Tests:** Fixtures for standard model, gated model, GGUF-heavy repo; assert extracted metadata and tags.

### Task 3: Notion & Generic Web Page Extractors (Scrapling Universal Fetch)
- **Files:** `apps/core/src/stash/extract/notion.py`, `apps/core/src/stash/extract/web.py`, `apps/core/tests/fixtures/web/*`, `apps/core/tests/test_extract_web.py`.
- **Approach:**
  - Notion: Scrapling `StealthyFetcher` renders public Notion pages until network idle; extracts title, rendered markdown text, and all outbound reference links.
  - Generic Web (Every link type): Universal fallback using Scrapling `Fetcher`. On 401/403, Cloudflare/turnstile challenges, or client-rendered SPAs, automatically escalates to `StealthyFetcher` (real Chrome / stealth fingerprint). Extracts page title, meta description, cleaned readable text, and discovers all outbound links and mentioned tools.
- **Tests:** Public Notion page fixture; generic blog post fixture; 403 JS-heavy fallback fixture.

### Task 4: PDF Extractor (Scrapling Remote Download + PyMuPDF)
- **Files:** `apps/core/src/stash/extract/pdf.py`, `apps/core/tests/fixtures/pdf/*`, `apps/core/tests/test_extract_pdf.py`.
- **Approach:**
  - For remote PDF links (`http://` or `https://` ending in `.pdf`), downloads file using Scrapling `Fetcher` into local `cache/`.
  - Local path or cached PDF is opened with `fitz.open()` (PyMuPDF); extracts plain text across pages and discovers embedded link annotations (`page.get_links()`).
- **Tests:** Sample PDF fixture with text and hyperlinks; verify text content and extracted URLs.

### Task 5: Follow-Through & Universal Dispatch Service
- **Files:** `apps/core/src/stash/services/extract.py`, `apps/core/tests/test_extract_dispatch.py`.
- **Approach:**
  - `extract_urls(urls: list[str], follow_depth: int = 1) -> list[SourceDoc]`:
    - Dispatches to appropriate extractor by URL pattern (Instagram, GitHub, HF, Notion, PDF, Web), ensuring all remote network requests route through Scrapling.
    - If `follow_depth > 0`: collects outbound GitHub/HF links mentioned in parsed content and enqueues them at `depth = 0`.
    - Skips already-extracted sources.
- **Tests:** Dispatcher routing; follow-through child link extraction; recursion boundary test (depth <= 1).

### Task 6: CLI Integration & Live Verification
- **Files:** `apps/core/src/stash/cli/__init__.py`, `apps/core/tests/live/test_extract_live.py`.
- **Approach:**
  - Ensure `stash extract <url...>` routes all supported URL types to the unified extract service.
  - Live tests in `tests/live/test_extract_live.py` run 3 sample links per source type when invoked with `-m live`.
- **Done:** unit tests with recorded fixtures green; ruff, pyright green; 3 passing sample links per extractor type.
