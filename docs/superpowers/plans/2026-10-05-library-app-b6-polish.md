# B6 Polish Pass: Plan

**Goal:** Motion and small extras, then the four checks: responsive, keyboard-only, contrast, bundle size.
**Spec:** `docs/library-app-spec.md` (Motion, Small extras, Build order B6, open question on feralui). Needs B1–B5.
**Stack:** Motion (`LazyMotion` + `m`), View Transitions API, morphicons (`MorphIcon` from `morphicons/react`), torph (`TextMorph` from `torph/react`), feralui pull-cord (if it passes the check).

## Constraints
- Everything falls back to instant under `prefers-reduced-motion`.
- Motion only for grid reorder and list enter/exit; CSS for the rest.
- Each extra is behind our own small wrapper so it can be dropped without touching callers.

## Review focus
1. **Reduced motion on:** no animation from Motion, morphicons, torph, view transitions or the cord. Test per wrapper.
2. **Browser without View Transitions:** navigation still instant and correct.
3. **Theme cord unusable by keyboard/screen reader:** plain toggle button stays behind it and is focusable.
4. **Bundle creep from extras:** initial JS budget enforced by script.
5. **Reorder animation on virtualized rows:** only visible tiles animate; no jump when rows recycle. Manual check.

---

### Task 1: Tile → card shared transition
- **Files:** `Tile.tsx`, card route header, router navigation options.
- **Approach:** View Transitions API (`viewTransition: true` on navigation, `view-transition-name: card-<slug>` on tile thumb and card header). Chosen over Motion `layoutId` because the card route is code-split; flagged in the overview for a spec update.
- **Tests:** transition name set on both elements; reduced motion disables the animation CSS.

### Task 2: Grid reorder + list presence
- **Files:** `VirtualGrid.tsx`, Pending/Rejected lists.
- **Approach:** `LazyMotion` with `domAnimation` loaded on demand; `m.div layout` on tiles; `AnimatePresence` on list rows.
- **Tests:** reduced motion renders without motion props effect (smoke).

### Task 3: Icon morphs
- **Files:** `src/components/MorphIcon.tsx`.
- **Approach:** Wrapper over morphicons fed Hugeicons icon data: menu ↔ close (drawer button), play ↔ pause (custom play button on the player), filter open ↔ close. Check first that Hugeicons data matches the format morphicons expects; if not, drop morphs and keep static icons.
- **Tests:** wrapper shows the right icon per state; aria label changes.

### Task 4: Text morphs
- **Files:** `src/components/TextMorph.tsx`.
- **Approach:** torph `TextMorph` for sidebar counts and the header title on view change.
- **Tests:** renders new text; `respectReducedMotion` left on.

### Task 5: Theme cord
- **Files:** `src/components/ThemeCord.tsx`.
- **Approach:** First check install, dependencies and license, plus keyboard and reduced-motion behavior (spec open question). Pass → cord at the sidebar bottom calling `toggle()`, plain toggle button behind it. Fail → keep the plain toggle and record the reason in the spec.
- **Tests:** plain toggle reachable by keyboard and toggles theme.

### Task 6: The four checks
- **Files:** `scripts/check-bundle.mjs`, checklist in the PR description.
- **Approach:**
  - Responsive at 375 / 768 / 1280, both themes, every route.
  - Keyboard-only walkthrough: every action reachable, focus visible, palette/dialog/drawer trap and restore focus.
  - Contrast: B0 token test green after any token change.
  - Bundle: script gzips `dist/assets/*.js` and fails if the initial chunk is over budget (proposed 250 KB gzip; graph, CodeMirror and Motion must be separate chunks).
- **Done (milestone):** all four checks pass.
