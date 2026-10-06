# Specification: `stash suggest` — Task-Oriented Consultation & Search Engine

**Date:** 2026-10-06  
**Status:** Approved for Implementation  
**Target:** Link Stash Core (`apps/core`) & Agent Skills (`skills/stash-suggest`)

---

## 1. Problem Statement & Motivation
Link Stash currently excels at ingesting, extracting, and organizing links, tools, practices, and models into `library/items/` and `inventory/`. However, when planning or building features with Claude Code or Antigravity, there is no fast mechanism to ask: *"Do I already have something installed or saved in stash that solves this?"*

Developers either re-download redundant libraries or forget about UI references, tools, or architectural practices previously curated.

`stash suggest` bridges this gap: a fast, local-first consultation command that queries installed inventory, saved library cards, and practices using SQLite FTS5 with tag/token ranking. If relevant matches exist, the agent leverages them; if nothing relevant is found, it cleanly returns `found: false` so the agent immediately proceeds to external web search without delay.

---

## 2. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────┐
│  Claude Code / Antigravity ("use stash for research")  │
└───────────────────────────┬────────────────────────────┘
                            │
               calls `stash suggest "<query>"`
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             apps/core/src/stash/cli/suggest.py         │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│        apps/core/src/stash/services/suggest.py         │
│  - Query tokenization & stop-word filtering            │
│  - FTS5 multi-field matching & tag boosting            │
│  - Partitioning: installed / cards / practices         │
│  - Threshold gating -> `found: true/false`             │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
               ▼                          ▼
┌───────────────────────────┐  ┌─────────────────────────┐
│     cards & tags table    │  │    inventory table      │
│  (title, body, tags, url) │  │  (name, kind, note)     │
└──────────────┬────────────┘  └──────────┬──────────────┘
               │                          │
               └────────────┬─────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│           SQLite FTS5 `search` Table                   │
│   (key, doc_type, title, body, transcript, caption)    │
└────────────────────────────────────────────────────────┘
```

---

## 3. Data Model Changes

### 3.1 Inventory Note Preservation
In `apps/core/src/stash/store/models.py`:
- Update `InventoryEntry` to include `note: str | None = None`.

In `apps/core/src/stash/store/lists.py`:
- Update `parse_inventory_line(line, origin)`:
  - When matching lines like `- [ui_ref] shadcn/ui — Modular reusable React component system (key: url:ui.shadcn.com)`, extract `Modular reusable React component system` as `note`.
  - Pass `note=note` when creating `InventoryEntry`.

### 3.2 FTS5 Indexing in `apps/core/src/stash/store/index.py`
- In `_index_card`:
  - When inserting into `search` FTS5 table, append `card.tags` and `card.features` to the searchable `body`:
    ```python
    extra_text = " ".join([*card.tags, *card.features])
    search_body = f"{body}\n{extra_text}" if extra_text else body
    ```
- In `_index_inventory`:
  - For each `InventoryEntry`, insert into `search` FTS5 table:
    - `key`: `entry.key or f"inv:{entry.origin}:{entry.name}"`
    - `doc_type`: `'inventory'`
    - `title`: `entry.name`
    - `body`: `f"[{entry.kind}] {entry.note or ''} origin:{entry.origin}"`

---

## 4. Query & Suggestion Engine

### 4.1 Store Query (`apps/core/src/stash/store/queries.py`)
Implement `suggest_matches(conn, query, category=None, kind=None, limit=20)`:
1. Extract tokens, sanitize punctuation, discard common stop words.
2. Formulate FTS5 match query with prefix support: `(token1* OR token2* ...)`.
3. Query `search` FTS5 table with BM25 ranking.
4. Join matches against `cards` and `inventory` to retrieve structured details (tags, url, path, origin, note).
5. Check exact and partial matches on `tags` table for bonus relevance score.

### 4.2 Suggestion Service (`apps/core/src/stash/services/suggest.py`)
Implement `suggest_items(home, query, category=None, kind=None, limit=5)`:
- Executes `suggest_matches`.
- Partitions results into 3 buckets:
  1. `installed`: Items from `inventory` (auto or manual) where `origin != "manual/practices.md"`.
  2. `cards`: Items from `cards` where `category != "practices"`.
  3. `practices`: Items from `cards` where `category == "practices"` OR inventory items where `origin == "manual/practices.md"`.
- If no results match or top score is below minimum threshold, sets `found: false`.
- Returns `SuggestResult`:
  ```python
  class SuggestResult(BaseModel):
      query: str
      found: bool
      installed: list[InstalledSuggestion]
      cards: list[CardSuggestion]
      practices: list[PracticeSuggestion]
  ```

---

## 5. CLI Interface (`apps/core/src/stash/cli/suggest.py`)

Register `stash suggest`:
```bash
stash suggest <query> [--category <cat>] [--kind <kind>] [--limit <n>] [--text]
```
- By default, outputs clean JSON formatted via `_print(...)`.
- With `--text`, outputs human-readable markdown with sections:
  - `### Installed & Available Tools`
  - `### Saved Library Cards`
  - `### Relevant Practices & Rules`
  - Or `No relevant items found in stash.` when `found == false`.

Wire `register_suggest_commands(app)` into `apps/core/src/stash/cli/__init__.py`.

---

## 6. Agent Skill (`skills/stash-suggest/SKILL.md`)

Create `skills/stash-suggest/SKILL.md` with frontmatter:
```yaml
---
name: stash-suggest
description: Consult Link Stash for relevant installed tools, saved library cards, or practices before installing new packages or planning features.
---
```
Instructions:
1. When asked to "use stash", or when planning a solution requiring external tools/libraries, run:
   ```bash
   stash suggest "<task keywords>"
   ```
2. If `found: true`:
   - Inspect `installed`: prefer using already-installed tools, skills, or models.
   - Inspect `cards`: examine saved UI components, repos, and libraries.
   - Inspect `practices`: follow applicable architecture or prompting rules.
3. If `found: false`:
   - Immediately proceed to web search or standard packages.

Update `apps/core/src/stash/services/skills.py` to copy/symlink `stash-suggest` during `stash install-skills`.

---

## 7. Testing & Verification

1. **Unit Tests (`apps/core/tests/test_suggest.py`)**:
   - `test_parse_inventory_note`: Verify note extraction from inventory lines.
   - `test_index_inventory_fts`: Verify inventory rows are searchable in FTS5 `search`.
   - `test_suggest_card_matches`: Querying tags/keywords returns cards.
   - `test_suggest_practices_matches`: Querying practices returns practice items.
   - `test_suggest_empty_skip`: Non-matching query returns `found: false`.
   - `test_cli_suggest_json`: Typer CLI invocation returns expected JSON schema.
2. **End-to-End Verification**:
   - Run `stash reindex` on `C:\Users\clash\stash`.
   - Test live queries (`"ui animation"`, `"prompting preserve"`, `"kubernetes deploy"`).
   - Test `--text` interactive output.
