# Stash Preference Learning: Design and Plan

Date: 2026-10-10. Status: approved, in progress.

## Goal

Stash learns what the user accepts and rejects during triage, so proposals in the review table drift toward the user's taste. Today triage works well; this is about capturing the signal now (past decisions cannot be recovered later) and keeping the smart layer small, readable and editable.

## Decisions (from brainstorming)

- Learned preferences only shift proposals. The user still approves every table. Nothing is hidden or auto-applied.
- Preferences live in an editable file: `library/preferences.md`.
- Rules are re-distilled at the end of a triage only when the user flipped a proposal or a rule was contradicted. Plain "go" runs cost nothing extra.
- Override reasons are inferred from the user's reply ("reject paywalls", "6 -> later"). No extra question.
- CLI only. Web app actions (delete, un-reject, bucket change) are not feedback signals.
- One-time seed from the current library and `rejected.md`; seeded rules are marked `seeded`.
- Drift is contradiction-driven: rules keep held/broken counts and a last-seen date. No time expiry.
- Proposals driven by a rule show a short tag in the table: `reject (pattern: paid UI kits 9/10)`.
- `stash suggest` gets a light boost from bucket and liked tags. BM25 stays the primary order.

## Research basis

- ERL (arXiv 2603.24639): distilled heuristics beat raw trajectories (56.1% vs 48.3% baseline; raw few-shot trajectories scored 46.4%, below baseline). Heuristics from failures beat heuristics from successes (58.9% vs 49.9%). Selective retrieval matters once the pool is large.
- ExpeL (arXiv 2308.10144, AAAI 2024): insight list maintained with ADD / UPVOTE / DOWNVOTE / EDIT so weak rules fade instead of being deleted outright.
- Google RecSys '23: LLMs are competitive near cold start from language-based preferences; numeric models win only after tens of labels. Supports rules-first at low volume.
- DeepMind degenerate feedback loops (arXiv 1902.10730) and AdaMem (arXiv 2606.21144): risk of filter bubbles and of mistaking transient noise for stable preference. Hence: rules never hide rows, and rules drop when contradicted.

Upgrade path, not built now: embeddings plus a regularized logistic regression scorer once `decisions.jsonl` passes roughly 200 entries and rules stop keeping up.

## Architecture

Three pieces, each independently testable:

1. Decision log (deterministic, CLI). `library/decisions.jsonl`, one JSON object per save or reject decision made through triage.
2. Preference rules (agent-maintained, user-editable). `library/preferences.md`.
3. Consumers. The `/stash` skill reads rules plus `stash prefs` output before proposing; `stash suggest` reads the log for liked tags.

Neither file is indexed. `store/index.py` only indexes `library/items`, `library/sources`, `rejected.md`, `pending.md` and `inventory/`, so no schema change and no migration.

### Decision log entry

Fields: `date`, `key`, `final` (`save` or `reject`), `proposed` (`save`, `reject` or `ask`), `bucket` (final, saves only), `proposed_bucket`, `category`, `tags`, `sources`, `reason`.

Written only when the caller passes `proposed`. Calls without it behave exactly as today and log nothing, so manual use and old scripts are unaffected.

An override is `proposed != final` (an `ask` row always counts as a decision, not an override), or a save whose `proposed_bucket` differs from `bucket`.

### Preference rules file

```
# Preferences
- [reject] Paid UI kits with no free tier. held 9, broken 1, last 2026-10-09
- [bucket:inspiration] Design galleries, even free ones. held 4, broken 0, last 2026-10-08
- [pin] [save] Windows-native MCP servers. held 2, broken 0, last 2026-10-01
- [reject] Beginner DevOps listicles. held 3, broken 0, last 2026-10-10, seeded
```

- Action tag: `[save]`, `[reject]`, `[ask]` or `[bucket:<name>]`.
- `[pin]`: never dropped by the agent.
- Drop rule (unpinned): broken >= 3 and broken > held.
- Cap about 25 rules; merge similar rules instead of growing.

### `stash prefs`

JSON summary of the log so the agent never reads raw history:
- `rules_path`, `rules` (text of `preferences.md`, or null), so one call loads everything
- `decisions`, `overrides`, `override_rate`
- `recent_overrides`: last 10 overrides with reason
- `by_category`: saved/rejected counts
- `liked_tags`: tags with >= 3 saves and >= 80% saves among their decisions
- `--seed`: adds a `library` block (card counts by category and bucket, top tags, reject reasons from `rejected.md`) for the one-time bootstrap.

### Suggest boost

Cards keep their BM25/tag-match position. Each card gets a small boost (one position) for bucket `try-now` or `upgrade`, and one more if it carries a liked tag. Stable sort on `position - boost`. Two-step boost cap keeps relevance dominant.

### Skill changes (`skills/stash/SKILL.md`)

- Step 5 (before proposing): read `library/preferences.md` and `stash prefs`. A rule may turn `ask` into `save`/`reject` or flag a `save` as `ask`. A rule never moves a row into the skipped list.
- Review table: rule-driven Proposed cell shows `(pattern: <rule> held/total)`.
- Step 7: pass `proposed` (and `proposed_bucket`) on every save and reject, plus `reason` when the user flipped the row.
- New step 8, Learn: only when the run had overrides or a contradicted rule. Update `preferences.md` with ADD / held+1 / broken+1 / EDIT / DROP. Report one line: "Learned: +1 rule, 2 reinforced, 1 weakened."
- Seed instructions: when `preferences.md` is missing, run `stash prefs --seed` once and write starter rules marked `seeded`.

## Files

- New `apps/core/src/stash/services/decisions.py`: append entry, read log, compute stats, liked tags, seed summary.
- `apps/core/src/stash/cli/triage.py`: `--proposed`, `--proposed-bucket`, `--reason` on `save`; `--proposed`, `--category`, `--tag` on `reject`; per-card `proposed` / `proposed_bucket` / `reason` in batch JSON; new `prefs` command.
- `apps/core/src/stash/services/suggest.py`: boost and stable re-sort of cards.
- `skills/stash/SKILL.md`: steps above.
- New `apps/core/tests/test_decisions.py`: logging and stats.
- Suggest boost test in the existing suggest test file.
- `CHANGELOG.md`: entry.

## Sequence

1. `services/decisions.py` plus tests (append, read, stats, liked tags, override detection).
2. Wire `save` / `reject` flags and batch fields; CLI tests for log-on-flag and no-log-without-flag.
3. `stash prefs` command with `--seed`.
4. Suggest boost plus ordering test.
5. SKILL.md steps 5, 6, 7, 8 and seed instructions.
6. Lint, format, typecheck, full test run. CHANGELOG.

## Tests

- Save with `proposed` writes one entry with card fields; save without it writes nothing.
- Batch save logs each card's own `proposed`; `proposed` fields never reach the card frontmatter.
- Reject with `proposed` logs `final: reject` with reason.
- Stats: override counting (including bucket-only overrides), `ask` not counted as an override, liked tags thresholds, empty log returns zeros.
- Suggest: with equal relevance, a `try-now` card with a liked tag moves above a plain one; a much more relevant card is not overtaken.
- Existing SKILL frontmatter test still passes.

## Done when

- All tests, ruff, format check and pyright pass.
- Running a triage logs decisions, and a flipped row produces a rule in `preferences.md` on the next learn step.
- No DB migration, no new dependency, no commit.
