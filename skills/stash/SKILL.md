---
name: stash
description: >-
  Full triage workflow: extract, unroll mentioned tools, probe health, compare against what the user already has, show review table, and save cards to Link Stash library.
---

# `/stash` - Triage Workflow

Use this skill when the user pastes one or more links to stash, or runs `/stash` with links.

Goal: be a sommelier, not a bouncer. Keep niche, experimental and region-specific finds (an Indian electronics vendor is a good save), but tell the user in one glance whether each thing is alive, what it costs, what they already have that does the same job, and why it is worth keeping.

`stash` must be on PATH (`uv tool install --editable apps/core` from the repo). If it is not, use `apps/core/.venv/Scripts/stash` (Windows) or `apps/core/.venv/bin/stash`.

## Workflow Steps

### 1. Check Open Pendings
`stash pending list`. List open items in one line each so the user knows which DM links are still awaited.

### 2. Ensure Inventory Freshness, Load Preferences
```bash
stash scan --if-stale
stash prefs
```
`stash prefs` returns the user's learned rules (`rules`, the text of `preferences.md` at `rules_path`), recent overrides with reasons, per-category save/reject counts and `liked_tags`. Keep them in mind for step 5d. This is the only preference surface: there is no `stash config`; edit rules in the file at `rules_path`.

When `rules` is null and no seed has happened yet, seed once: run `stash prefs --seed`, read the `library` block (card counts by category and bucket, top tags, reject reasons), and write 5-15 starter rules to `rules_path` in the format of step 8, each ending in `, seeded`. Only write patterns the data clearly shows (several rejects with the same reason, a category that is mostly one bucket). Tell the user in one line and continue.

### 3. Extract Sources
```bash
stash extract <url1> <url2> ...
```
Pass every pasted link in one call, then run steps 4 and 5 for all of them in one sweep. Do not stop to ask between posts; collect every question for the review table.

Note any `img_index=N` in the pasted Instagram links: the user bookmarked slide N of a carousel (see step 4).

For Instagram reels, run `stash analyze <id>` to get mentions, takeaways, CTA keywords and summary. `<id>` may be the key (`ig:ABC`), the folder name (`ig-ABC`) or the bare shortcode.

If `stash analyze` returns `engine: "frames"` with a `needs_agent` block, every video engine failed; `summary` names why per engine and whether a transcript exists (`whisper off` is the default, not an error). Open the `contact` image, read the caption in `source.md` and any `transcript`, and go straight to step 4. `stash ingest <id> -` is optional (it only records `raw.json` for the web app); `needs_agent.template` and `stash ingest --template` show the shape.

Vision beats transcription for names: speech-to-text mangles handles and domains ("good night triple zero" for `goodnight000`, "new form" for `neuform.ai`). Read repo names, URLs and star counts from the contact sheet, carousel slides and screenshots; use the transcript only for context.

Carousels have no extracted slide text (no OCR by design; `on_screen_text: []` and `summary: null` are normal). Open the slide images in the source folder and read them; start with the bookmarked slide and the cover, then the tool slides.

If `stash extract` reports `blocked`, a `blocked` pending item exists asking for the mp4. Tell the user where to save it; rerunning `stash extract` picks it up.

### 4. Unroll Into Candidates
A reel or carousel is usually a wrapper around several tools. The post itself is never the candidate; the things it names are.
A link pasted directly (GitHub, Hugging Face, web page) is itself the one candidate; its README `mentions` are context for the card, not extra candidates.
- One candidate per mention (repo, model, tool, skill, plugin, mcp, link) and one per actionable practice.
- Mention without a URL: find the official URL (Scrapling or web search). Ambiguous names (Cursor, Bolt, Warp, Zed...) need the URL that matches the context; ask if still unclear.
- Names from transcripts or frames can be misspelled by speech-to-text; confirm the spelling against the real project.
- Shortener (`bit.ly`, `t.co`) or link-in-bio hub (`linktr.ee`, `beacons.ai`): follow it to the real tool links. Never save the hub or the shortener.
- Listicle or SEO article: extract the concrete tools it names. The article is not a card.
- Huge `awesome-*` list: one candidate for the list itself (bucket `later` or `inspiration`), do not unpack it.
- Bookmarked slide (`img_index=N` in the pasted link): look at slide N after extracting, never before.
  - Cover, intro, outro or CTA slide ("Comment X for the links"): unroll every tool slide, no question.
  - Slide N is one tool among several distinct tools: unroll all, mark row N as bookmarked in the table, and ask in the review step: "You linked slide N (<thing>). Just that, or all <count>?"
- Beginner educational listicle ("7 repos to learn DevOps", Docker 101, roadmap.sh, interview prep lists): skip by default. Name the skipped items in one line under the table so the user can pull any back. Keep deep architecture guides and production references. Surface beginner material only if the user asks for it.
- Comment-for-link, DM keyword, "link in bio" with no usable link, or "part 2 tomorrow": create a pending item (step 7) instead of guessing. If the slides, caption or frames already name the tools or domains, the CTA is resolved: find the official links and skip the pending item.

### 5. Probe, Check, Compare
For every candidate:

**a. Check + health** (pass job tags so same-job cards surface even with different names):
```bash
echo '{"title": "Componentry", "url": "https://componentry.dev", "kind": "tool", "tags": ["tailwind-components"]}' | stash check --live -
```
- `status`: `duplicate_library` / `duplicate_inventory` / `previously_rejected` / `overlap` / `new`.
- `candidates`: similar names (length-penalized fuzzy score) plus cards sharing a tag (`shared_tags`). A high score is a hint, not a verdict.
- `health.status`: `live`, `dead` (404/410, DNS failure, parked domain), `blocked` (403/429/bot wall: unknown, NOT dead), `error`.
- `health.flags`: `archived`, `stale` (no push for a year), `no_license`, `renamed` (use `health.canonical_key`), `redirected_domain`, `shortener`, `link_hub`, `parked_domain`.
- `blocked`: fetch the page with Scrapling (`stealthy_fetch`) before judging it.
- Several candidates: send them as one JSON array. The output is an array in the same order; a bad row comes back as `{"error": ...}` without stopping the rest.
  ```bash
  echo '[{"title": "Widget", "url": "https://github.com/acme/widget", "kind": "repo"}, {"title": "Componentry", "url": "https://componentry.dev", "kind": "tool"}]' | stash check --live -
  ```

**b. Pricing** (judged by you, not the CLI). Open the landing page, and the `/pricing` page when one exists. Badges:
`free` (open source or no paid tier) / `freemium` (useful free tier) / `paid` / `trial` (time-limited) / `waitlist` / `card-required` (free tier needs a card) / `open-core` (self-host free, cloud paid) / `byo-key` (needs a paid third-party API key) / `vendor` (a shop or supplier) / `unknown`.
For repos, the license is part of pricing: flag `AGPL`, non-commercial, or source-available (`BSL`, `SSPL`, `Elastic`) licenses. `no_license` is often a detection miss (license in a subfolder, README, or nonstandard file), so list it as a plain `no license found` note in `Pricing` and keep going; never let it block or change a proposal on its own.

**c. Job-to-be-done comparison.** Before proposing a save, answer "what do they already have that does this job?":
- Run `stash suggest "<job keywords>"` to instantly check existing tools, cards, and practices. You can also inspect `stash check` candidates.
- To look up a thing by name or URL (is it already saved?), use `stash check <name-or-url>`, not `suggest`: it returns the matching card key with a name score.
- Decide one relation: `gap` (nothing does this), `alternative` (same job, different tradeoff: lighter, self-hosted, no deps, different aesthetic), `upgrade` (clearly better than something they use), `complement` (works alongside), `redundant` (same job, no advantage).
- Name the concrete difference in a few words ("zero-JS pure Tailwind vs Radix-based shadcn", "GUI companion to gallery-dl").

**d. Patterns.** Match each candidate against the rules from step 2:
- A rule that clearly fits may turn an `ask` row into `save` or `reject`, set the bucket, or turn a `save` row into `ask` (the user tends to reject this kind of thing).
- A rule never moves a row into the skipped line and never hides it. Every pattern-driven decision stays visible in the table so the user can override it.
- Hard checks still win: dead, unsafe and duplicate rows follow Edge Cases whatever a rule says.
- A rule with more broken than held, or one that only loosely fits, is a hint at most: leave the row `ask`.


### 6. Review Table
One table per source post, headed with the post (creator, what it is, and the bookmarked slide if any), numbered continuously across posts so one-line answers still work. Plain text badges only (no emoji anywhere). Link names with reference-style links underneath.

**Post 1: @creator reel "5 UI tools" (bookmarked slide 3: Componentry)**

| # | Thing | Health | Pricing | Compares with | Adds | Bucket | Proposed |
|---|---|---|---|---|---|---|---|
| 1 | [Componentry][1] | live | free (MIT) | shadcn/ui, Kokonut UI | zero-dep pure Tailwind, no Radix | try-now | save |
| 2 | [Robu.in][2] | blocked (bot wall, page ok) | vendor | - (gap) | Indian electronics supplier | later | save |
| 3 | [Details.so][3] | live | freemium | Refero Design | micro-interaction catalog | inspiration | save |
| 4 | [UI Arc][4] | live | paid ($49, no free tier) | Tailark Blocks | nothing free | - | reject (pattern: paid UI kits 9/10) |
| 5 | [ekzhang/openjev][5] | dead (404) | unknown | - | - | - | reject |
| 6 | Cobalt | live | free (self-host) | gallery-dl | web UI vs CLI | alternative? | ask |
| 7 | reel "5 AI Agents" | gated | - | - | - | - | pending (comment AGENT) |

Skipped (beginner listicle): Docker 101, roadmap.sh. Say a name to pull it back.

Buckets (stored on the card, filterable in the web app):
- `try-now`: improves the daily stack today (CLI, MCP server, free UI kit for an active project).
- `later`: high utility for a future kind of project (hardware suppliers, WebGL libs, niche vendors).
- `upgrade`: replaces something already in inventory with a clearly better version. Name what it replaces.
- `inspiration`: reference only (design galleries, paid kits with great patterns, architecture write-ups). Paid or closed things that are still worth seeing go here, never `try-now`.

Keep the review fast:
- `Adds` is the punchline in a few words; `Compares with` names what they already have.
- Restrictive licenses (AGPL, FSL, BSL, SSPL, non-commercial) and paywalls go in `Pricing` so they are visible before anything lands in work code. A missing license is listed there too (`no license found`), as a static note only.
- Clear rows (live, permissive license or free, `gap`/`complement`/`upgrade`, no CTA) are `save`. Rows needing judgment (paid, restrictive license (not a missing one), `alternative`/`redundant`, bookmarked slide, unclear name) are `ask`.
- A proposal decided by a rule (step 5d) names it: `reject (pattern: paid UI kits 9/10)`, where 9/10 is held out of held + broken.
- Remember each row's proposal and bucket as shown; step 7 logs them.

Below the table, one line: "Saving N clear rows. Decide: #4, #6." Ask only about `ask` rows. The user can answer in one line ("go", "save try-now and later, reject paywalls, 6 -> later"). Write the full tables in your reply text first; the user must see them before any decision prompt. Only after the tables are printed, and only when the host has a multiple-choice question tool, offer the `ask` rows as options there (each option names its row number and thing). The tool never replaces the tables. Never save before the user answers.

### 7. Apply Verdicts
- Save (flags; no temp JSON needed). Use the canonical key/URL (after redirects and renames), strip tracking and referral params, and add 1-3 job tags reused from similar cards:
  ```bash
  stash save --url https://componentry.dev --title Componentry --category ui-ux --kind tool \
    --tag tailwind-components --bucket try-now --source ig:C12345 --body "<card markdown>"
  ```
  Several cards: pipe a JSON array (card fields plus `body`; `key` is derived from `url` when missing). Flags apply to every card, so shared values like `--source` go once:
  ```bash
  echo '[{"url": "https://componentry.dev", "title": "Componentry", "category": "ui-ux", "kind": "tool", "tags": ["tailwind-components"], "bucket": "try-now", "body": "..."}]' | stash save --source ig:C12345 -
  ```
  Cards from different posts in one save: put `sources` on each card and leave out `--source`. A file works the same as stdin (`stash save triage.json`):
  ```bash
  echo '[{"url": "https://componentry.dev", "title": "Componentry", "category": "ui-ux", "sources": ["ig:C12345"], "body": "..."}, {"url": "https://github.com/acme/widget", "title": "Widget", "category": "repos-tools", "sources": ["github:acme/widget"], "body": "..."}]' | stash save -
  ```
  Saving a key that already exists merges the new source into the existing card (second reel about the same tool), so propose `merge`, not a new card. The merge call needs only the key and source (`stash save --key <key> --source <source>`); title, category and kind come from the existing card.
- Reject: `stash reject <key> --reason "<reason>" --proposed <save|reject|ask> --category <category> --tag <tag> --source <source_key>`. `--source` moves the post to stage `triaged`, same as save, so a post whose candidates were all rejected does not stay `fetched`. Several rejects: pipe a JSON array (flags apply to every row):
  ```bash
  echo '[{"key": "github:acme/old", "reason": "abandoned", "proposed": "reject", "category": "repos-tools"}, {"key": "web:paidkit.io", "reason": "paid UI kit", "proposed": "ask", "tags": ["ui-kit"]}]' | stash reject --source ig:C12345 -
  ```
- Log every save and reject made from the review table: pass `--proposed` (what the table proposed: `save`, `reject` or `ask`) and, for saves, `--proposed-bucket`. In a JSON array, put `proposed`, `proposed_bucket` and `reason` on each card instead. When the user flipped a row ("6 -> later", "reject paywalls"), add `reason` with their reason in a few words, inferred from the reply; do not ask for one. Leave `--proposed` out for saves the user requested directly outside a table.
  ```bash
  echo '[{"url": "https://componentry.dev", "title": "Componentry", "category": "ui-ux", "bucket": "try-now", "proposed": "save", "proposed_bucket": "try-now", "body": "..."}, {"url": "https://cobalt.tools", "title": "Cobalt", "category": "repos-tools", "bucket": "later", "proposed": "ask", "reason": "keep as GUI fallback", "body": "..."}]' | stash save --source ig:C12345 -
  ```
- Pending (`--kind cta` is the default and covers comment-for-link and DM keywords; `blocked` is for unfetchable media):
  ```bash
  stash pending add --source ig:C12345 --instruction "Comment AGENT on the reel, paste the DM link here"
  ```

Print one summary line: saved, merged, rejected, pending.

### 8. Learn
Skip this step when the user accepted every proposal as shown and no rule was contradicted. Otherwise update the file at `rules_path`, using what was flipped and why:
- New pattern in a flip (or the same reason on 2+ rows): add a rule.
- A rule applied and the user agreed: `held` +1, update `last`.
- A rule applied and the user overrode it: `broken` +1, update `last`. If the reason shows the rule is too broad, edit it narrower instead.
- Drop an unpinned rule once `broken` >= 3 and `broken` > `held`. Never drop or edit a `[pin]` rule's action.
- Keep it under about 25 rules: merge near-duplicates rather than adding.

One line per rule; the user may edit the file, so keep their edits:
```
# Preferences
- [reject] Paid UI kits with no free tier. held 9, broken 1, last 2026-10-09
- [bucket:inspiration] Design galleries, even free ones. held 4, broken 0, last 2026-10-08
- [pin] [save] Windows-native MCP servers. held 2, broken 0, last 2026-10-01
- [ask] macOS-only CLIs. held 1, broken 0, last 2026-10-10, seeded
```
Actions: `[save]`, `[reject]`, `[ask]`, `[bucket:<try-now|later|upgrade|inspiration>]`. A rule describes a kind of thing (pricing, license, platform, category, job), never a single key; one-off decisions are already in the log.

Report one line: "Learned: +1 rule, 2 reinforced, 1 weakened."

## Categories
Use the seed categories (`models`, `skills-plugins`, `mcp-servers`, `repos-tools`, `ui-ux`, `practices`) when they fit. When a thing clearly belongs to a domain with none (hardware, electronics, 3d, audio...), propose a new kebab-case category in the table instead of forcing a bad fit, and create it only after the user agrees. New categories get a color automatically (`cat-extra-1..8`); to pin one, add it under `[category_colors]` in `config.toml`.

## Edge Cases

Reject without hesitation, and say why in the reason:
- Dead: 404/410, DNS failure, parked or for-sale domain, deleted repo.
- Fake free: "free" kit that gates every usable asset behind payment with no free tier.
- Content farm listicle with no concrete tool behind it.
- Unsafe: cracked or "free premium" software, crypto wallet drainers, browser extensions asking for broad permissions with no clear reason, `curl | sh` installers from unknown domains, typosquat or impersonation repos (name close to a famous project, different owner, few stars). Verify the owner is the official one.
- Redundant: same job as something in inventory with no advantage, or superseded by a tool they already use. Name the existing tool.
- Vague practice with nothing actionable ("use AI to code faster"), or a practice already in `inventory/manual/practices.md`.

Keep, but flag clearly:
- `blocked` health: unknown, not dead. Verify with Scrapling first.
- `archived`: no more fixes. Fine for finished small libraries, risky for fast-moving areas (agents, LLM tooling).
- `stale`: same judgment as archived.
- `redirected_domain`: acquired, rebranded or hijacked. Confirm the final page is still the same product.
- `renamed`: save under `health.canonical_key`, and check again with the new name.
- Restrictive license: fine for `inspiration`, flag it for anything used in work code.
- `no_license`: list it, do not ask about it. A row that is otherwise `save` stays `save`.
- Fork or mirror: prefer the upstream unless the fork is the maintained one.
- Very new repo with a star spike and no releases: say "early", do not auto-reject.
- Placeholder repo or waitlist-only product ("coming soon", README only): `later` at most, usually skip.
- Platform fit: the user is on Windows. Flag macOS-only or Linux-only tools; check the install section.
- Hardware fit: local models note size and VRAM/RAM needs; ask if it may not fit.
- Region-specific vendors and services: keep, note the region.
- Version or size variant of an existing model (Llama 3.1 vs 3.2, 8B vs 70B): `upgrade` or `alternative`, not a duplicate.
- Sponsored post (`#ad`, "paid partnership") or the creator selling their own course: note it, judge the thing on its merits.
- `previously_rejected`: show the old reason and date; only re-propose if something changed (now free, now maintained).
