---
name: stash-have
description: Add installed tools, models, UI references, or practices to the inventory (single item or batch).
---

# `/stash-have` — Quick Inventory Insertion

Use this skill when the user installs a new tool, adopts a new practice, or bookmarks a component kit and wants to record it immediately into `inventory/manual/`.

## Usage

### Single Item
```bash
stash have "<item or url>"
```

Examples:
- `stash have "https://github.com/d4vinci/scrapling"`
- `stash have "[ui_ref] shadcn/ui — default component kit https://ui.shadcn.com"`
- `stash have "[practice] Plan before building multi-file features"`

### Batch Ingestion (Fast / Multi-line)
Pipe multiple lines via stdin into `stash have -`:
```bash
stash have -
```
Example stdin block:
```text
[ui_ref] Lenis — smooth scroll engine https://lenis.dev
[tool] macbrow — browser use agent https://github.com/timpratim/macbrow
[practice] Never commit directly
```

## Workflow

1. Execute `stash have "<argument>"` or pipe lines to `stash have -`.
2. The CLI will:
   - Resolve URLs to canonical keys (e.g. `https://github.com/owner/repo` -> `github:owner/repo`)
   - Determine target manual files (`tools.md`, `ui-ux.md`, `practices.md`, or `models.md`)
   - Append under a single atomic write lock without corrupting existing lines
   - Reindex entries into the SQLite `inventory` table
3. Report the result back to the user with the recorded item names, kinds, keys, and origin files.
