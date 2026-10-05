---
name: stash-pending
description: View open comment-for-link pending items and resolve them with a received DM link.
---

# `/stash-pending` — Resolve Comment-for-Link Queue

Use this skill when the user receives an Instagram DM containing a promised download link or repository URL from a comment-for-link reel.

## Workflow

1. **List Open Pendings:**
   If invoked without arguments (`/stash-pending`), list all pending items:
   ```bash
   stash pending list
   ```
   Display each open item with its ID, original Instagram post URL, and instruction keyword.

2. **Resolve an Item:**
   When the user provides a pending ID and the received URL:
   ```bash
   stash pending resolve <id> --url <resolved_url>
   ```
   This marks the item status as `ready` and attaches the resolved URL to `library/pending.md`.

3. **Continue Triage:**
   Prompt the user if they would like to immediately triage the resolved link with `/stash <resolved_url>`.
