# B3 Card Page: Plan

**Goal:** `/c/$slug` with read-only body, Notes editor (CodeMirror 6) with `[[slug]]` completion and autosave, 409 banner, properties form, category move, reject dialog.
**Spec:** `docs/library-app-spec.md` (Card page, Properties panel, Conflicts). Needs B1 + B2.
**Stack:** react-markdown, CodeMirror 6 (`@codemirror/view`, `state`, `lang-markdown`, `autocomplete`; lazy-loaded), shadcn `Select`, `Dialog`, `DropdownMenu`.

## Constraints
- Body is read-only; only Notes + category/kind/tags are editable.
- Every save sends `base_hash`; 409 never overwrites silently.
- New ChipInput goes in `components/ui/` (shared primitive).

## Review focus
1. **Own save echoed by SSE while still typing:** ignore events whose hash equals our last saved hash; no false banner. Test.
2. **Notes save and property change at the same time:** saves are serialized, each uses the hash returned by the previous one. Test.
3. **Navigating away with an unsaved debounce:** flush the pending save on unmount / `beforeunload`. Test.
4. **Markdown in body with raw HTML or `javascript:` links:** not rendered as HTML, unsafe URLs stripped. Test.
5. **Notes line that looks like a section heading:** API 422 shown inline, typed text kept. Test.

---

### Task 1: Read-only body
- **Files:** `src/features/card/CardBody.tsx`, `src/features/card/wikilinks.ts`.
- **Approach:** Preprocess `[[slug]]` into links using `resolved` from the API; unresolved ones render as a muted "unresolved" span. react-markdown, no raw HTML.
- **Tests:** resolved link href `/c/slug`; unresolved styled; raw `<script>` and `javascript:` not rendered.

### Task 2: Save hook
- **Files:** `src/features/card/useCardSave.ts`.
- **Approach:** Promise chain serializes saves. Tracks `baseHash` and `lastSavedHash`. States: idle / saving / saved / conflict / error. On 409 stores `current_hash`; `keepMine()` re-sends with it; `reload()` refetches and resets.
- **Tests:** sequential saves use returned hash; 409 → conflict; keepMine re-sends with new hash.

### Task 3: Notes editor + autosave
- **Files:** `src/features/card/NotesEditor.tsx`, `src/features/card/wikilinkCompletion.ts`.
- **Approach:** Small CM6 wrapper, lazy-imported, `data-lenis-prevent`. Completion triggers after `[[`, queries search API for cards. Autosave 800 ms after last keystroke; flush on unmount.
- **Tests:** completion returns options after `[[`; debounce fires once (fake timers); flush on unmount.

### Task 4: Page assembly + reconcile + banner
- **Files:** `src/routes/c.$slug.tsx`, `src/features/card/reconcile.ts`, `src/features/card/ConflictBanner.tsx`.
- **Approach:** `reconcile(serverHash, lastSavedHash, dirty)` → ignore / reload / conflict. Listens to card events from B2. Banner: "Reload from disk" / "Keep mine". Layout per spec: properties column right ≥ 1024, stacked below on mobile.
- **Tests:** reconcile table; own hash ignored; dirty + foreign change shows banner, not reload.

### Task 5: Properties form + ChipInput
- **Files:** `src/features/properties/PropertiesForm.tsx`, `src/components/ui/chip-input.tsx`.
- **Approach:** Category and kind Selects (from `meta`), tags ChipInput (Enter/comma adds, Backspace removes, autocomplete from meta tags). Each change saves immediately via the save hook. Read-only fields listed. Field errors from `details.fields` shown next to the field.
- **Tests:** chip add/remove/backspace + autocomplete; field error rendered; category change calls save.

### Task 6: Reject dialog
- **Files:** `src/features/card/RejectDialog.tsx`, `⋯` menu on page.
- **Approach:** Reason required; `DELETE /api/cards/{slug}`; on success toast + navigate to `/`.
- **Tests:** empty reason blocks submit; success calls DELETE and navigates.

**Done (milestone):** editing Notes in the app and the file in VS Code at the same time never loses an edit (manual script: edit both, confirm banner, both choices keep the right text).
