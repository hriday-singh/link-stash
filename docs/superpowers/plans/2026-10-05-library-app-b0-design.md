# B0 Visual Design Pass: Plan

**Goal:** Scaffold `apps/web`, lock every visual token in one `tokens.css` (light + dark), show a static Feed + card-page mock in both themes for approval.
**Spec:** `docs/library-app-spec.md` (Design system, Build order B0). Overview: `2026-10-05-library-app-00-overview.md`.
**Stack:** Vite, React 19, TS strict, Tailwind v4, shadcn (Radix base, `iconLibrary: "hugeicons"`), Geist via fontsource, Vitest + RTL, culori (dev, contrast test).

## Constraints
- No hex/rgb/oklch/px in components; tokens only. Token names follow shadcn (`--background`, `--muted-foreground`, ...) plus `--success`, `--warning`, `--cat-*`.
- Light + dark, follows system, manual toggle. Reduced motion respected globally.
- `localStorage` per-browser only, always in try/catch.
- Never commit; each task ends at a checkpoint (lint + typecheck + tests, list files, suggest message).

## Review focus
1. `localStorage` throws: theme still follows system.
2. Theme flash before React mounts: inline script in `index.html`.
3. Long titles at 375 px: clamp, no overflow.
4. Unknown key shapes (`ollama:x:y`, `url:...`) on generated tiles: fall back to title.
5. Muted text on muted surfaces: most likely AA failure, covered by contrast test.

---

### Task 1: Scaffold `apps/web`
- **Files:** `apps/web/*` from `pnpm create vite --template react-ts`; `vite.config.ts`; `src/test/setup.ts`; `pnpm-workspace.yaml` at root if missing.
- **Approach:** Replace template content. Tailwind v4 via `@tailwindcss/vite`. `@/` alias to `src`. Dev proxy `/api` to `127.0.0.1:8765`. Vitest with jsdom, jest-dom, a `matchMedia` stub in setup. ESLint (template) + Prettier. Scripts: `dev build test lint typecheck format`.
- **Tests:** smoke test renders "Link Stash" heading.
- **Done:** tests, lint, typecheck, build all pass.

### Task 2: shadcn init + token file
- **Files:** `components.json`, `src/styles/tokens.css`, `src/lib/categories.ts`, `src/styles/tokens.test.ts`.
- **Approach:** `shadcn init -b radix -t vite`, point `tailwind.css` at `src/styles/tokens.css`, set `iconLibrary: "hugeicons"`, add `button input separator tooltip`. `tokens.css` holds:
  - `:root` and `.dark` blocks: zinc neutrals, indigo primary, destructive/success/warning, 6 seed `--cat-*` + `--cat-extra-1..8`, motion durations.
  - `@theme`: Geist Sans/Mono, type scale xs–2xl, spacing base, breakpoints 640/768/1024/1280, radius sm/md/lg, two soft shadows, ease curves.
  - `@theme inline` maps the color vars to Tailwind colors.
  - Base layer (body colors, focus ring), `.tile-tint` (category tint via `color-mix`), global reduced-motion rule.
- **Interfaces:** `SEED_CATEGORIES`, `categoryColorVar(token) -> "var(--cat-…)"` (falls back to `cat-extra-8` for bad tokens).
- **Tests:** parse `tokens.css`; for both themes assert WCAG AA (≥ 4.5) on fg/bg, muted-fg on bg/card/muted, primary-fg on primary, destructive-fg on destructive, status colors on bg; every category token defined in both themes. If a pair fails, change only that token's lightness.
- **Done:** contrast test green, build green.

### Task 3: Theme provider
- **Files:** `src/state/theme.tsx` (+ test), `index.html`, `main.tsx`.
- **Approach:** Context with `theme` (light/dark/system), `resolved`, `setTheme`, `toggle`. Listens to `prefers-color-scheme`. Toggles `.dark` and `color-scheme` on `<html>`. Key `stash.theme`. Inline no-flash script in `index.html`.
- **Tests:** follows system by default; toggle flips and stores; still works when storage throws.

### Task 4: Tile, GeneratedTile, CategoryPill
- **Files:** `src/lib/kinds.ts`, `src/components/{Tile,GeneratedTile,CategoryPill}.tsx` (+ tests).
- **Approach:** `KIND_ICON` maps the 9 kinds to Hugeicons free icons. `generatedLabel(key, title)` returns big label + small label (`github:owner/repo` gives repo + owner, `hf:model:org/name` gives name + org, practice gives first 6 words, anything else gives the title). Tile: 4:5 thumb (lazy img) or generated tile, clamped title, category pill, optional corner badge slot. Hover lift via transform + shadow, token durations.
- **Interfaces:** `TileData { slug, key, title, category, categoryColor, kind, thumbUrl, platform }`, `Tile({data, badge?})`. B2 reuses these unchanged.
- **Tests:** label table (7 key shapes incl. unknown ones); generated tile when no thumb; img when thumb; title + pill shown.

### Task 5: Static mock + approval gate
- **Files:** `src/mock/{mock-data.ts,MockFeed.tsx,MockCard.tsx}`, `App.tsx` (feed/card/theme switcher).
- **Approach:** Static sidebar, search input, day-grouped responsive grid (1/2/3/4 cols), card page with body, Notes box, reject button, properties column that stacks on mobile.
- **Tests:** switcher shows "Today" then "Notes".
- **Done:** user approves tokens + mock (screenshots of both themes at 375 and 1280 px). Changes go into `tokens.css` only, contrast test re-run. B2 deletes `src/mock/`.
