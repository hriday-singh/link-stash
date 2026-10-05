# B4 Stash Views: Plan

**Goal:** Sources list + source page with player and seekable stamps, Pending resolve, Rejected with un-reject, Inventory with add, full brand logo set.
**Spec:** `docs/library-app-spec.md` (Stash views, Empty and error states). Needs B1–B3.
**Stack:** Existing stack only. HTML5 `<video>` (range requests already served by B1).

## Constraints
- Reuse `VirtualGrid`, `Tile`, filter-in-URL pattern from B2. No new list component.
- Resolve and add go through the same core services as the CLI.

## Review focus
1. **Source with no video file** (fetch failed, carousel): show poster or generated tile, no broken player. Test.
2. **Stamps beyond video length or malformed (`99:99`, `1:2`):** not linkified / clamped. Test.
3. **Pending resolve with a non-URL or non-http URL:** inline error, item stays open. Test.
4. **Un-reject of an already removed entry** (CLI did it): 404 handled as a quiet refresh, not an error toast loop. Test.
5. **Inventory with hundreds of entries:** all pages fetched, grouped correctly. Test.

---

### Task 1: Sources list
- **Files:** `src/routes/sources.tsx`, `src/features/sources/filters.ts`.
- **Approach:** Grid of source tiles (thumb, creator, platform logo, stage). Filters: platform, creator, stage, has-video in URL.
- **Tests:** filter params round trip; tile links to `/s/$id` with encoded key.

### Task 2: Source page
- **Files:** `src/routes/s.$sourceId.tsx`, `src/features/sources/{Player.tsx,stamps.ts}`.
- **Approach:** `<video>` with poster, `preload="metadata"`. `parseStamp("MM:SS")` and `splitStamps(text)` turn stamps in transcript into seek buttons; mentions list with `at` stamps. Shows caption, summary, on-screen text, cards from this source (grid), link to original reel.
- **Tests:** parseStamp/splitStamps table incl. malformed; clicking a stamp sets `currentTime`; no video → no player.

### Task 3: Pending
- **Files:** `src/routes/pending.tsx`, `src/features/pending/ResolveForm.tsx`.
- **Approach:** Each item: instruction ("Comment `GUIDE` on <reel>"), URL field (`type=url`), resolve → status "ready". Empty state one line.
- **Tests:** invalid URL shows error; resolve calls POST and shows ready.

### Task 4: Rejected
- **Files:** `src/routes/rejected.tsx`.
- **Approach:** Table: key (mono), date, reason, Un-reject button. 404 on un-reject → refetch quietly.
- **Tests:** un-reject calls DELETE and removes row; 404 path refetches without toast.

### Task 5: Inventory
- **Files:** `src/routes/inventory.tsx`, `src/features/inventory/group.ts`.
- **Approach:** Fetch all pages; `groupByOrigin` → auto tools (with brand logo) then manual files. "Add" field → `POST /api/inventory`.
- **Tests:** grouping; add calls POST and refetches.

### Task 6: Brand logos
- **Files:** `src/assets/brands/*.svg` (Notion, Ollama, LM Studio, Claude, Gemini added to B2's three), `src/components/BrandLogo.tsx`.
- **Approach:** `brandFor(platformOrTool)` map, `<img>` with alt text, unknown → nothing.
- **Tests:** map table incl. unknown.

**Done (milestone):** resolving a pending in the app is picked up by the next `/stash` run.
