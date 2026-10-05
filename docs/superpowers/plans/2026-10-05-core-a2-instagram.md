# A2 Instagram Extractor: Plan

**Goal:** `stash extract <url...>` turns Instagram reel/post links into one source record each, with video and thumbnail on disk, resumable, failures logged.
**Spec:** `docs/link-stash-spec.md` (Source extractors, Instagram notes, Resumable stages, Identity keys, Failure modes, Build order A2). Contract names: `2026-10-05-library-app-00-overview.md` (`SourceDoc`, `stash.store.sources`).
**Stack adds:** `scrapling[fetchers]` (embed page), `httpx` (media download), `pyyaml` (source.md frontmatter).

## Constraints
- Scrapling used as a library, never the MCP server.
- Parsing is a pure function over HTML, so unit tests run on recorded fixtures with no network.
- Live tests live in `tests/live/`, marked `live`, excluded from the default run and CI.
- Writes go through one lock. SQLite index is not built here; `write_source` skips reindex until the index milestone.
- Out of scope: yt-dlp + burner cookies fallback, manual mp4 path, reel engines, triage. A blocked embed ends as `blocked:fetch` in `failed.jsonl`.

## Review focus
1. URL variants all map to one `ig:<shortcode>` key (username prefix, `/reels/`, `/tv/`, `igsh`/`utm_*`, trailing slash).
2. Killing the run mid-batch, then re-running, never re-downloads a finished source.
3. Expired video URL (403, `oe` in the past) re-fetches the embed page once, then fails cleanly.
4. Partial downloads land in `cache/` and are renamed into place only when complete.
5. Comment-for-link caption sets `cta.keyword` as a hint only; A2 never routes to pending (that is A7, and only when analysis finds no concrete mention).

---

### Task 1: Keys
- **Files:** `src/stash/store/keys.py`, `tests/test_keys.py`.
- **Approach:** `ig_key(url) -> str` per the identity-keys table; non-Instagram or malformed URL raises `Invalid`. `source_dir(home, key)` gives `library/sources/ig-<code>/`.
- **Tests:** every variant in the table, plus rejects.

### Task 2: Embed parser + CTA
- **Files:** `src/stash/extract/instagram.py`, `tests/fixtures/instagram/*.html`, `tests/test_instagram_parse.py`.
- **Approach:** `parse_embed(html, shortcode) -> IgRecord`: author, caption, comment count, video URL, poster URL, carousel items, `oe` decoded to an expiry datetime. Missing video and caption, or a login redirect, raises a fetch-blocked error. `detect_cta(text)` applies the spec's comment/type/drop + quoted word + DM/link/send rule.
- **Fixtures:** recorded once from real embed pages (reel, carousel, single image post, comment-for-link reel, login wall).
- **Tests:** each fixture parses to the expected fields; CTA positive and negative captions.

### Task 3: Store: models, lock, source writes
- **Files:** `src/stash/store/models.py`, `src/stash/store/lock.py`, `src/stash/store/sources.py`, `tests/test_store_sources.py`.
- **Approach:** `SourceDoc` per the contract. Lock is a stdlib exclusive-create file at `STASH_HOME/.lock`, 30 s wait, then `LockTimeout`. `write_source` writes `source.md` (YAML frontmatter + caption body) and `raw.json`; `read_source` raises `NotFound`. `append_failed(home, entry)` writes `logs/failed.jsonl`.
- **Tests:** round trip; second lock holder times out; failed log appends valid JSON lines.

### Task 4: Fetch + download service
- **Files:** `src/stash/services/extract.py`, `tests/test_extract_service.py`.
- **Approach:** For each key: skip if `source.md` exists at stage `fetched` or later and media is present. Otherwise fetch `/<type>/<code>/embed/captioned/` with `StealthyFetcher` (resources disabled), batches of at most 6 with 2–5 s jitter; 429 or empty page stops the batch and leaves the rest. Download `video.mp4`, `thumb.jpg` (poster, else first ffmpeg frame), carousel media as `item-<n>.<ext>` via httpx streaming into `cache/`, then rename. 403 with expired `oe` re-fetches once. Every failure goes to `failed.jsonl` with a named reason. `--retry-failed` re-runs keys from that log.
- **Tests:** fetcher and httpx mocked; resume skips finished keys; expired-URL path re-fetches once; rate-limit stop leaves the remainder unprocessed; failures logged.

### Task 5: CLI
- **Files:** `src/stash/cli/__init__.py`, `tests/test_cli.py`.
- **Approach:** `stash extract <url...> [--retry-failed]` prints a JSON list of records (key, stage, paths, cta, error). Non-Instagram URLs return `Invalid` with "supported from A3" until those extractors exist.
- **Tests:** mixed input JSON shape; unsupported URL error shape.

### Task 6: Live check (you run it)
- **Files:** `tests/live/test_instagram_live.py`, `tests/live/ig_links.txt` (gitignored, one URL per line).
- **Approach:** Runs the A2 "done" test against your links: N records, N playable files (ffprobe), the CTA reel flagged, and a run killed at item 10 then resumed without re-downloads.
- **Done:** unit tests, ruff, pyright green locally; live test passes on the Predator with 20 links.
