# B5 Backlinks and Graph: Plan

**Goal:** Link panels in the card properties column, local graph on the card page, global graph at `/graph`.
**Spec:** `docs/library-app-spec.md` (Backlinks and graph). Needs B1–B4.
**Stack:** sigma.js + graphology, `graphology-layout-forceatlas2/worker` (layout off the main thread). Graph code lazy-loaded.

## Constraints
- Graph data comes from `GET /api/graph` (global, or `center` + `depth`); B1 already builds nodes (card/source/creator) and edges (source/overlap/wikilink, creator edges travel with `source`).
- Colors from category tokens, read from CSS at runtime (no hex in code).
- Graph container carries `data-lenis-prevent`.

## Review focus
1. **Theme switch with graph open:** node/label colors re-read from tokens. Test the mapping with a resolver.
2. **Card with no links:** local graph shows the single node + "no connections yet", not an empty canvas.
3. **Large library (thousands of nodes):** layout runs in worker and stops after a time budget; main thread stays responsive. Manual check with generated data.
4. **Unresolved wikilink / overlap pointing to inventory:** shown in panels as text, not as a broken graph edge. Test.
5. **Unmount mid-layout:** worker killed, sigma killed, no leaks (navigate away fast). Test the cleanup call.

---

### Task 1: Link panels
- **Files:** `src/features/properties/LinkPanels.tsx`.
- **Approach:** From `/api/cards/{slug}/links`: Backlinks, Mentioned by (sources with creator + thumb), Outgoing; Overlaps resolve to card links or inventory names; unresolved as muted text.
- **Tests:** each section renders; unresolved and inventory targets as text.

### Task 2: Graph conversion + view
- **Files:** `src/features/graph/{toGraphology.ts,GraphView.tsx}`.
- **Approach:** `toGraphology(graph, resolveColor)` sets size by type and color by category token. `GraphView`: sigma on a container, FA2 supervisor in worker, stop after budget, hover shows label (source: thumb tooltip), click → callback. Kill both on unmount. Re-color on theme change.
- **Tests:** conversion attributes; cleanup kills supervisor and renderer (mocked).

### Task 3: Local graph on card page
- **Files:** card route properties column.
- **Approach:** 1 hop default, 2-hop toggle, centered on current card, click navigates.
- **Tests:** depth toggle changes query key.

### Task 4: Global graph
- **Files:** `src/routes/graph.tsx`.
- **Approach:** Full-height view, filters (category, edge types) in URL, click node → `/c/$slug` or `/s/$id` (creator nodes → sources filtered by creator).
- **Tests:** filter params; node type → route mapping.

**Done (milestone):** a reel with three saved cards shows the expected source and creator links in both graphs.
