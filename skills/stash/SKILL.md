---
name: stash
description: Full triage workflow: extract, analyze, check dedup/overlap, show review table, and save cards to Link Stash library.
---

# `/stash` — Triage Workflow

Use this skill when the user pastes one or more links to stash, or runs `/stash` to process items waiting in the triage queue.

## Workflow Steps

### 1. Check Open Pendings and Queue
Check `library/pending.md` for open comment-for-link items (`[open]`).
If there are open pendings, list them in one line each so the user is aware of DM links awaiting input.
Check `library/queue.md`. If it contains URLs, state how many links are queued for triage.

### 2. Ensure Inventory Freshness
Run the inventory scan with freshness check:
```bash
stash scan --if-stale
```
This updates `inventory/auto/` if older than 24 hours without delaying if already fresh.

### 3. Extract Sources
- If the user provided URLs in their prompt:
  ```bash
  stash extract <url1> <url2> ...
  ```
- If no URLs were provided, pop the next chunk (default 15) from the queue:
  ```bash
  stash queue next --n 15
  ```
  Then run `stash extract` on the popped URLs.

For Instagram reels, run `stash analyze <id>` (or use `stash ingest <id> -` if analyzing directly in-session) to extract mentions, takeaways, CTA keywords, and summary.

If `stash analyze` returns `engine: "frames"` with a `needs_agent` block, every video engine failed and the reel is not analyzed yet. Open the `contact` image (labeled timestamps on each tile), read the caption in `source.md` and any `transcript` in the output, fill the reel schema yourself, and pipe the JSON to the `next` command (`stash ingest <id> -`).

If `stash extract` reports `blocked`, a `blocked` pending item is created asking for the mp4. Tell the user where to save it; rerunning `stash extract` on that link picks it up.

### 4. Split Records into Candidates
Split each extracted source record into candidate things:
- One candidate per mention (repo, model, tool, skill, plugin, mcp, link)
- One candidate per practice/technique if the source contains actionable workflow rules or takeaways
- If a post has a comment-for-link CTA keyword and zero concrete mentions, mark it as a blocked pending candidate

### 5. Check Candidates for Deduplication and Overlap
For each candidate, run `stash check`:
```bash
stash check <candidate.json>
```
The check returns:
- Exact duplicate in `library/`: returns existing card slug and category
- Exact hit in `inventory/`: already installed or tracked
- Exact hit in `rejected/`: previously rejected with date and reason
- Overlap candidates: existing cards or inventory items with similarity score >= 75

### 6. Review Table and Confirmation
Present a clear, compact Markdown review table to the user with numbered rows:

| # | Thing | Kind | Category | Verdict | Proposed |
|---|---|---|---|---|---|
| 1 | owner/repo | repo | repos-tools | new | save |
| 2 | Model-8B | model | models | overlap: model-8b in Ollama | ask |
| 3 | tool-name | tool | repos-tools | rejected 2026-09-12 (reason) | skip |
| 4 | "Workflow rule" | practice | practices | similar to manual entry | ask |
| 5 | reel C12345 | - | - | blocked: comment GUIDE | pending |

Underneath the table, ask concise clarifying questions for any items marked `ask` (overlaps, unclear category, or custom notes).

### 7. Apply Verdicts
Once the user confirms (e.g. `save 1 2, skip 3, 4 -> practices`), execute the changes:
- For items to save:
  ```bash
  stash save <card.json>
  ```
- For items to reject:
  ```bash
  stash reject <key> --reason "<reason>"
  ```
- For blocked CTA reels:
  ```bash
  stash pending add <pending.json>
  ```

Print one concise summary line showing total saved, rejected, and queued.
