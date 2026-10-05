---
name: stash-have
description: Add one installed tool, model, UI reference, or practice to the inventory.
---

# `/stash-have` — Quick Inventory Insertion

Use this skill when the user installs a new tool, adopts a new practice, or bookmarks a component kit and wants to record it immediately into `inventory/manual/`.

## Usage

Command:
```bash
/stash-have <thing or url>
```

Examples:
- `/stash-have https://github.com/d4vinci/scrapling`
- `/stash-have [ui_ref] shadcn/ui — default component kit (key: github:shadcn-ui/ui)`
- `/stash-have [practice] Plan before building multi-file features`

## Workflow

1. Take the argument string and execute:
   ```bash
   stash have "<argument>"
   ```
2. The CLI will:
   - Resolve URLs to canonical keys (e.g. `https://github.com/owner/repo` -> `github:owner/repo`)
   - Determine the target manual file (`tools.md`, `ui-ux.md`, `practices.md`, or `models.md`)
   - Append the entry under write lock without corrupting existing lines
   - Reindex the entry into the SQLite `inventory` table
3. Report the result back to the user with the recorded item name, kind, key, and origin file.
