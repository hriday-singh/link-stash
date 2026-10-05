# B2 Shell, Grid, Search: Plan

**Goal:** App shell (sidebar/drawer), Lenis scroll, shared virtualized grid, Feed / category / search pages, Ctrl+K palette, URL filters, empty states, live sync.
**Spec:** `docs/library-app-spec.md` (Layout, Routes, Grid and tiles, Search and navigation, Live sync). Needs B0 + B1.
**Stack:** TanStack Router (file routes, `autoCodeSplitting`), TanStack Query, TanStack Virtual, openapi-fetch, zod (search params), Lenis, shadcn `Sheet`, `Command`, `Select`, `Sonner`.

## Constraints
- Server state = TanStack Query only. Client state (sidebar, theme) = Context.
- Filter state lives in the URL. Every view has a URL.
- Lenis on the main scroll container only; palette, dialogs, drawers carry `data-lenis-prevent`.
- Mobile-first; verify at 375 / 768 / 1280.

## Review focus
1. **Unknown/invalid URL params** (`?kind=banana`): dropped silently, page still loads. Test.
2. **SSE drops** (laptop sleep, server restart): reconnect with backoff, refetch everything on reconnect, show "reconnecting" in the sidebar. Test.
3. **Palette typing fast:** debounced, stale responses never overwrite newer ones (query key per term). Test.
4. **Empty library on first run:** Feed shows the "Paste links into `/stash`…" message, not a blank grid. Test.
5. **Sidebar width from storage is garbage or storage throws:** clamp to min/max, fall back to default. Test.

---

### Task 1: Router, Query, API client
- **Files:** `vite.config.ts` (router plugin), `src/routes/__root.tsx`, `src/main.tsx`, `src/api/{client.ts,keys.ts}`; delete `src/mock/`.
- **Approach:** `api = createClient<paths>()` with fetch wrapper (so tests can spy). `unwrap()` throws `ApiError {status, code, message, details}`. QueryCache `onError` → Sonner toast with `message`. Query key factory: `cards(filters)`, `card(slug)`, `cardLinks(slug)`, `sources(f)`, `source(id)`, `pending`, `rejects`, `inventory`, `meta`, `search(q)`, `graph(p)`.
- **Tests:** `unwrap` maps error body to `ApiError`; toast shown on query error.

### Task 2: Sidebar context + AppShell
- **Files:** `src/state/sidebar.tsx`, `src/components/AppShell.tsx`, `src/components/SidebarNav.tsx`.
- **Approach:** ≥ 1024 px: collapsible sidebar with drag-to-resize (clamped), width + collapsed stored. Below: `Sheet` drawer from a menu button. Nav: Feed, Sources, Pending (count), Rejected, Inventory, Graph, then categories with color dots + counts from `meta`, theme toggle at bottom.
- **Tests:** persists width/collapsed; garbage or throwing storage falls back; drawer opens below 1024 px.

### Task 3: Lenis scroll container
- **Files:** `src/lib/lenis.ts`, `src/components/MainScroll.tsx`.
- **Approach:** One Lenis on the main container (wrapper + content), exposed through context so the virtualizer uses the same element. Destroyed on unmount. Lenis handles reduced motion.
- **Tests:** none (glue); covered by manual check.

### Task 4: Shared virtual grid
- **Files:** `src/components/VirtualGrid.tsx`, `src/lib/grid.ts`.
- **Approach:** `columnsForWidth(w)` (1/2/3/4 at 640/1024/1280). `buildRows(items, cols, groupByDay)` makes header rows + tile rows. Row virtualizer on the scroll container; container width via ResizeObserver. Infinite loading: fetch next page when last row is near. Generic `renderItem` so B4 reuses it. Tiles link to `/c/$slug` and show the platform brand logo (Instagram, GitHub, HF SVGs from theSVG in `src/assets/brands/`).
- **Tests:** `columnsForWidth` table; `buildRows` day grouping; renders tiles with `initialRect` in jsdom.

### Task 5: Filters in URL
- **Files:** `src/features/search/filters.ts`, `src/features/search/FilterBar.tsx`, `src/features/feed/useCards.ts`.
- **Approach:** zod schema for kind, category, tag, creator, since, until, has_video (invalid values dropped). FilterBar: Selects, native date inputs, has-video switch; writes via `navigate({search})`. `useCards(filters)` = infinite query on `/api/cards`.
- **Tests:** parse/serialize round trip; invalid params dropped; changing a filter updates the URL.

### Task 6: Feed, category, search pages + empty states
- **Files:** `src/routes/index.tsx`, `src/routes/category.$name.tsx`, `src/routes/search.tsx`.
- **Approach:** Feed = grid grouped by day. Category = same grid with category fixed. Search = FTS results as grid. Empty Feed message per spec; empty search says so.
- **Tests:** empty feed message; category page passes category filter.

### Task 7: Ctrl+K palette
- **Files:** `src/features/search/CommandPalette.tsx`, `src/features/search/Snippet.tsx`.
- **Approach:** Ctrl/Cmd+K toggles a `Command` dialog. Debounced (150 ms) search; hits show title + snippet (markers `\x02`/`\x03` rendered as `<mark>` via React nodes, never HTML). Commands: go to each view, toggle theme, rebuild index (`POST /api/reindex`).
- **Tests:** Ctrl+K opens; debounce sends one request; Enter on hit navigates; snippet renders marks without injecting HTML.

### Task 8: Live sync
- **Files:** `src/lib/sse.ts`, `src/lib/useLiveSync.ts`.
- **Approach:** `EventSource('/api/events')` with backoff reconnect (1 s → 30 s). `keysForEvent(evt)` → query keys (`card.changed` → cards, card, links, graph, search, meta; `source.changed` → sources, cards, graph; `state.changed` → pending, rejects, inventory, meta; `index.rebuilt` → all). Re-dispatches card events on an `EventTarget` for B3. Refetch all on reconnect. Status → sidebar indicator.
- **Tests:** `keysForEvent` table; fake EventSource error → reconnect with backoff → invalidate all.

**Done (milestone):** every card reachable by sidebar, palette and filters at 375 and 1280 px.
