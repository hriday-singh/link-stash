---
name: stash-feedback
description: >-
  Run right after /stash in the same session. Review how the triage run went from the agent's side (friction, confusion, human-in-the-loop waits), save the report to the stash feedback folder, and print it for copy-paste.
---

# `/stash-feedback` - Run Retrospective

Use this skill when the user runs `/stash-feedback` after a `/stash` run (or any other stash skill) in the same conversation.

Goal: honest, evidence-backed feedback on what made stash slow, confusing, or dependent on the human, so the next version is easier. This is a report, not a fix: do not edit the repo, skills, or library.

## Rules

- Use only this session. Every point cites something that actually happened: a command run, an output line, a retry, a question asked. No generic advice ("add better docs", "improve error handling").
- Quote the shortest decisive line of output, never full logs.
- If a section has nothing real, write `none`. Do not pad.
- Be candid about your own mistakes too (wrong command, skipped step, misread instruction) and say what in stash would have prevented them.
- Plain text only, no emoji.
- If no stash run happened in this session, say so and stop.

## Steps

1. Re-read `skills/stash/SKILL.md` (or the skill that was run) so you can quote exact lines when the instructions were unclear. Run `stash doctor` to get the version and `home` path.
2. Walk the session top to bottom and write the report below.
3. Save it to `<home>/feedback/YYYY-MM-DD-HHMM-<agent>.md` (create the folder if missing; `<agent>` is your host, e.g. `claude-code`, `antigravity`).
4. Final output: the saved path on one line, then the full report in a single fenced `markdown` block so the user can copy it in one go. Nothing after the block.

## Report Template

```markdown
# Stash feedback - YYYY-MM-DD HH:MM - <agent> - stash <version>

## Run recap
- Input: N links (sources: instagram, x, github, ...)
- Output: N candidates, N saved, N rejected, N pending, N asked
- CLI calls: N total (stash extract xN, stash check xN, ...), N failed or retried

## Friction
| # | Step | What happened | Evidence | Cost | Severity |
|---|---|---|---|---|---|
| 1 | 3. Extract | carousel slides fetched one by one | `stash extract ...` x7 | 6 extra calls | med |

## Confusing skill instructions
- Quote: "<exact line from SKILL.md>"
  - Problem: <what was ambiguous or contradicted another rule>
  - Rewrite: "<proposed line>"

## Human in the loop
For each point where the run waited on the user:
| # | Why the human was needed | What they had to know or do | What stash could have pre-collected or printed | Could it be removed? |
|---|---|---|---|---|
| 1 | gated reel (comment for link) | comment keyword, wait for DM | post URL + keyword + one-line DM checklist | no, needs account |

Required access this run: list every app/account the user had to be signed in to (Instagram, X, GitHub, ...) and which step needed it, so next time it can be checked up front.

## Proposed changes
### Skill
- <file>: <change> (fixes Friction #N)
### CLI
- `stash <command> <flag>`: <behavior> (fixes Friction #N)
### Suspected bugs
- <symptom> - repro: `<command>` - expected / actual

## Top 3
1. <change> - would have saved <calls/time/questions> in this run
2. ...
3. ...
```

The user deletes a feedback file once it has been addressed, so each file must stand alone (no "see previous feedback").
