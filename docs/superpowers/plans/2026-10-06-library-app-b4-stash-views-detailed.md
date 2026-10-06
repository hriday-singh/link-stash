# Milestone B4: Stash Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver live Stash Views: Sources list with filters, Source detail page with HTML5 player and seekable timestamps, Pending resolution form, Rejected table with quiet 404 un-reject, Inventory tool grouping with add form, and Brand Logos suite.

**Architecture:** 
- Route files in `apps/web/src/routes/` are thin route declarations that delegate to feature components in `apps/web/src/features/`.
- Brand logo resolution via normalized mapping in `src/components/BrandLogo.tsx` with dedicated SVG assets in `src/assets/brands/`.
- URL search param serialization and validation for Sources filters (`platform`, `creator`, `stage`, `has_video`).
- HTML5 `<video>` player supporting HTTP range requests, with metadata preloading and timestamp seeking (`parseStamp`, `splitStamps`). Fallback poster/tile when no video exists.
- In-place mutation and query invalidation for Pending (`POST /api/pending/{id}/resolve`), Rejected (`DELETE /api/rejects/{key}` with quiet 404 handling), and Inventory (`POST /api/inventory`).

**Tech Stack:** React 19, TypeScript (strict mode), TanStack Router, TanStack Query, Tailwind CSS v4, tokens in `tokens.css`, Vitest, Testing Library.

**Spec:** `docs/library-app-spec.md` (Stash views), `docs/superpowers/plans/2026-10-05-library-app-b4-stash-views.md`.

## Global Constraints
- Never run database migrations.
- Never commit to git.
- Zero hardcoded colors/px; everything references tokens from `tokens.css`.
- Strict TypeScript (`tsc -b` passes with zero errors; no `any`).
- ESLint passes with zero errors.
- Every feature ships with unit tests on the same change.
- No single file exceeds 700 lines.
- Responsive on mobile and desktop.

---

### Task 1: Brand Logos and Icons Suite
**Files:**
- Create: `apps/web/src/assets/brands/instagram.svg`
- Create: `apps/web/src/assets/brands/github.svg`
- Create: `apps/web/src/assets/brands/huggingface.svg`
- Create: `apps/web/src/assets/brands/notion.svg`
- Create: `apps/web/src/assets/brands/ollama.svg`
- Create: `apps/web/src/assets/brands/lmstudio.svg`
- Create: `apps/web/src/assets/brands/claude.svg`
- Create: `apps/web/src/assets/brands/gemini.svg`
- Create: `apps/web/src/assets/brands/antigravity.svg`
- Create: `apps/web/src/assets/brands/codex.svg`
- Create: `apps/web/src/assets/brands/qwen.svg`
- Create: `apps/web/src/components/BrandLogo.tsx`
- Test: `apps/web/src/components/BrandLogo.test.tsx`

**Interfaces:**
- `brandFor(name: string): BrandInfo | null`
- `<BrandLogo brand={name} className={...} />` renders SVG with accessible title/alt or null if unknown.

---

### Task 2: Sources Filters and Sources List Page
**Files:**
- Create: `apps/web/src/features/sources/filters.ts`
- Create: `apps/web/src/features/sources/filters.test.ts`
- Create: `apps/web/src/features/sources/SourceCard.tsx`
- Create: `apps/web/src/features/sources/SourcesPage.tsx`
- Create: `apps/web/src/features/sources/SourcesPage.test.tsx`
- Modify: `apps/web/src/routes/sources.tsx`

**Interfaces:**
- `parseSourceFilters(input): SourceFilters`
- `serializeSourceFilters(filters): Record<string, string>`
- `GET /api/sources` with `platform`, `creator`, `stage`, `has_video`
- Empty state: clean styled message when no sources found.

---

### Task 3: Timestamp Seeking, Video Player, and Source Detail Page
**Files:**
- Create: `apps/web/src/features/sources/stamps.ts`
- Create: `apps/web/src/features/sources/stamps.test.ts`
- Create: `apps/web/src/features/sources/Player.tsx`
- Create: `apps/web/src/features/sources/Player.test.tsx`
- Create: `apps/web/src/features/sources/SourceDetailPage.tsx`
- Create: `apps/web/src/features/sources/SourceDetailPage.test.tsx`
- Create: `apps/web/src/routes/s.$sourceId.tsx`

**Interfaces:**
- `parseStamp(stamp: string): number | null` (supports MM:SS, HH:MM:SS; malformed/out-of-bounds return null)
- `splitStamps(text: string): StampChunk[]`
- `<Player videoUrl={...} thumbUrl={...} hasVideo={...} ... />`: if no video, renders poster or generated tile, never a broken `<video>`
- Clicking a stamp sets `currentTime` and plays
- Shows caption, summary, on-screen text, mentions with `at` chips, cards from this source, external link to original URL.

---

### Task 4: Pending Resolution Page
**Files:**
- Create: `apps/web/src/features/pending/ResolveForm.tsx`
- Create: `apps/web/src/features/pending/ResolveForm.test.tsx`
- Create: `apps/web/src/features/pending/PendingPage.tsx`
- Create: `apps/web/src/features/pending/PendingPage.test.tsx`
- Modify: `apps/web/src/routes/pending.tsx`

**Interfaces:**
- `GET /api/pending`
- `POST /api/pending/{id}/resolve` with `{ url: string }`
- Inline error validation if non-URL or non-http(s) URL; item stays open
- Status updates to `ready` upon resolution
- Clean one-line empty state.

---

### Task 5: Rejected Log Page with Quiet 404 Un-reject
**Files:**
- Create: `apps/web/src/features/rejected/RejectedPage.tsx`
- Create: `apps/web/src/features/rejected/RejectedPage.test.tsx`
- Modify: `apps/web/src/routes/rejected.tsx`

**Interfaces:**
- `GET /api/rejects`
- `DELETE /api/rejects/{key}`
- If DELETE returns 404, quietly refetch without error toast
- Monospace key, date, reason, Un-reject button
- Clean one-line empty state.

---

### Task 6: Inventory Tool Grouping and Manual Add
**Files:**
- Create: `apps/web/src/features/inventory/group.ts`
- Create: `apps/web/src/features/inventory/group.test.ts`
- Create: `apps/web/src/features/inventory/InventoryPage.tsx`
- Create: `apps/web/src/features/inventory/InventoryPage.test.tsx`
- Modify: `apps/web/src/routes/inventory.tsx`

**Interfaces:**
- `groupByOrigin(items: InventoryEntry[]): InventoryGroup[]`
- Auto tools (with BrandLogo) and Manual inventories
- `POST /api/inventory` with `{ text: string }`
- Handles large sets of entries efficiently.

---

### Task 7: Full Verification and Scorecard Update
- Vitest suite passing
- Pytest suite passing
- Typecheck (`tsc -b`) passing with 0 errors
- ESLint passing with 0 errors
- Vite build passing cleanly
- Update `docs/progress-tracker.md` and complete B4
