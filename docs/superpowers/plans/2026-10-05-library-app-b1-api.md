# B1 Serve and API: Plan

**Goal:** `stash serve` (FastAPI in the core package) serving every endpoint in the spec, SSE live events from the watcher, and OpenAPI → TS types for the web app.
**Spec:** `docs/library-app-spec.md` (API, Live sync, Conflicts). Core contract: overview file. Needs A4 + A7 done.
**Stack:** FastAPI (version with `fastapi.sse`; check `import fastapi.sse`), uvicorn, Starlette `FileResponse` (built-in range support), tomlkit, pytest + TestClient, anyio for async tests.

## Constraints
- Routes thin: validate, call service, return. SQL only in `store/`. Business logic in `services/`.
- Every write takes the core lock (reentrant). Error shape `{"error": {"code","message","details"}}` from one central handler.
- Bind `127.0.0.1` only. List endpoints: `cursor` + `limit` (default 50, max 200), return `{items, next_cursor}`.
- Never commit; checkpoint after each task.

## Review focus
1. **DNS rebinding / cross-site writes:** reject requests whose `Host` or `Origin` is not `127.0.0.1`/`localhost` (403). Test.
2. **Own save echoes back as SSE:** `card.changed` carries the new `hash` so the app can ignore its own write. Test.
3. **Category move = delete + create in one watcher batch:** must emit one `card.changed`, never `card.deleted`. Decide from index state, not change type. Test.
4. **Raw user search input** (`"`, `AND (`, `-`): must not 500. Quote tokens, prefix-match last. Test.
5. **Media path escape:** a source row pointing outside `library/sources/` returns 404. Test.

---

### Task 1: Notes section split/replace
- **Files:** `stash/store/notes.py`, `tests/store/test_notes.py`.
- **Approach:** Section headings are lines starting `**Word.**`. `split_notes(body) -> (body_without_notes, notes)`. `replace_notes(body, notes) -> body`: replaces the span, inserts before `**Origin.**` if missing, removes the section when empty. `check_notes(notes)` rejects a line that looks like a heading (it would break the next parse).
- **Tests:** table: notes in middle / at end / missing / empty-to-remove; other sections byte-identical; heading injection rejected.

### Task 2: Paging + FTS query helpers
- **Files:** `stash/services/paging.py`, `tests/services/test_paging.py`.
- **Approach:** Opaque cursor = urlsafe base64 JSON of the last sort values (keyset for cards/sources, offset for small lists). Bad cursor raises `Invalid`. `fts_query(text)` quotes each token, adds `*` to the last one, returns None for blank input.
- **Tests:** round trip; garbage cursor gives `Invalid`; fts quoting table incl. quotes and operators.

### Task 3: Read queries (store) + library service
- **Files:** `stash/store/queries.py`, `stash/services/library.py`, `stash/server/schemas.py`.
- **Approach:** SQL for card list (filters: category, kind, tag, creator, since, until, has_video; order `added DESC, slug ASC`; thumb/platform from first source via `json_extract`), card row by slug, slug resolution, links (backlinks, mentioned-by, outgoing incl. inventory names and unresolved `slug:` targets), sources list (platform, creator, stage, has_video), search with `snippet()` using `\x02`/`\x03` markers (client renders, no HTML from server), meta counts, rejects/inventory lists. Service builds Pydantic outputs: `CardTile` (with `thumb_url`), `CardDetail { slug, card, body (no notes), notes, hash, resolved: {slug: title} }`, `SourceRow`, `SourceDetail` (incl. `video_url`, `thumb_url`, cards), `SearchHit`, `Meta`, `Page[T]`. Card detail reads the file (source of truth) and hashes it.
- **Tests:** covered via API tests in Task 6.

### Task 4: Card edit + reject services, category colors
- **Files:** `stash/services/card_edit.py`, `stash/services/meta.py`.
- **Approach:** `update_card(home, slug, patch)`: under lock read file, compare `content_hash` with `base_hash` (mismatch raises `Conflict` with `current_hash`), apply kind/tags (normalized)/category (must be known)/notes, validate through `Card`, render, write atomically to `card_path(new category)`, unlink + de-index old path on move, reindex. `reject_card(home, slug, reason)`: reason required, `add_reject` + unlink + de-index. `category_colors(home, cfg, names)`: seeds map to `cat-<name>`; others read from `[category_colors]` in `config.toml`; missing ones get the next free `cat-extra-N` and are written back with tomlkit under the lock (stable across sessions).
- **Tests:** in Task 6.

### Task 5: App factory, errors, security, static SPA, CLI
- **Files:** `stash/server/app.py`, `stash/cli/serve.py`, `stash/cli/__init__.py`.
- **Approach:** `create_app(cfg, dev)`. Central handlers: `StashError` → status by code (404/409/422/503), request + Pydantic validation → 422 with `details.fields [{field, message}]`, anything else → 500 logged. Host/Origin guard middleware. Per-request SQLite connection dependency; sync routes run in threadpool. Non-dev: serve `apps/web/dist` (config `web_dist` override), SPA fallback to `index.html`, `/api/*` unknown gives JSON 404. `stash serve [--port] [--dev]`: exits 1 with "build it" message if `dist/index.html` missing. `stash openapi` prints the schema JSON.
- **Tests:** evil Host → 403; evil Origin → 403; unknown `/api/x` → JSON 404; serve with missing dist exits 1 with message.

### Task 6: Routes + API tests
- **Files:** `stash/server/routes/{cards,sources,state,misc}.py`, `tests/server/conftest.py`, `tests/server/test_api_*.py`.
- **Approach:** Every endpoint in the spec table, plus `POST /api/reindex` (rebuild in threadpool, publish `index.rebuilt`). Source key routes use `{key:path}`; video/thumb routes registered before detail. Media: whitelist column, resolve path, must be inside `library/sources/`, `FileResponse`. Pending resolve body uses `HttpUrl`. Fixture: temp `STASH_HOME` with 3 cards (repo with wikilink, model, practice) + 1 source with small video/thumb files, written through core `save_card`/`write_source`. TestClient with `base_url=http://127.0.0.1`.
- **Tests:** list order + `limit=1` pagination walks all with no dupes; each filter; card detail fields; Notes save changes only Notes (rest of file byte-identical); stale hash → 409 + `current_hash`; category move (old file gone, GET works); bad kind → 422 field error; reject → 404 after, listed in rejects; un-reject; range request → 206 + `Content-Range`; media path escape → 404; meta seeds + new category gets `cat-extra-1` persisted; search snippet markers; weird search input → 200; graph/links basics; pending resolve (bad URL 422); inventory add/list.

### Task 7: Live events (watcher → SSE)
- **Files:** `stash/server/events.py`, route in `misc.py`, `tests/server/test_events.py`.
- **Approach:** `events_for_changes(home, changes)`: card paths → per-slug event decided from index (`card.changed {slug, hash}` if row exists, else `card.deleted {slug}`), deduped; `source.md` → `source.changed`; `pending/rejected.md` and `inventory/**` → `state.changed {file}`. `EventHub`: per-subscriber bounded queue; on overflow clear it and push `index.rebuilt` (forces full refetch, no silent loss). Watcher task in lifespan, restarts after errors with a log line. SSE route sends a `connected` comment, events, and keep-alive pings every 15 s.
- **Tests:** mapping table incl. move batch → single `card.changed`; overflow → `index.rebuilt`; integration: `save_card` from "CLI" → hub receives `card.changed` within 5 s; SSE framing with a fake finite hub.

### Task 8: OpenAPI → TS types
- **Files:** `apps/web/src/api/schema.d.ts` (generated), `apps/web/package.json` script `gen:api`, CI step.
- **Approach:** `stash openapi > apps/web/openapi.json`, `openapi-typescript` → `schema.d.ts`. CI regenerates and fails on diff.
- **Done (milestone):** all API tests pass; saving a card from the CLI emits `card.changed` on `/api/events`.
