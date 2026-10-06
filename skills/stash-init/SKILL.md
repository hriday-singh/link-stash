---
name: stash-init
description: Guided brain dump into inventory/manual/ for tools, UI references, and practices.
---

# `/stash-init` — Guided Inventory Onboarding

Use this skill to help the user perform an initial inventory brain dump or expand their manual inventory across tools, UI references, and engineering practices.

## Workflow

Guide the user through one category at a time in chat. After each prompt, wait for their answer and record each provided item using `stash have`:

1. **Repositories & Tools:**
   - Prompt: "What command-line tools, libraries, dev applications, or scraping utilities do you currently use that aren't auto-scanned?"
   - For each item, run:
     ```bash
     stash have "[tool] <name> — <description> <optional_url>"
     ```

2. **UI & UX References:**
   - Prompt: "What design systems, UI kits, icon sets, or frontend component references do you regularly build with or refer to (e.g., shadcn/ui, Radix, Tailwind, Lucide)?"
   - For each item, run:
     ```bash
     stash have "[ui_ref] <name> — <description> <optional_url>"
     ```

3. **Engineering Practices:**
   - Prompt: "What engineering rules, prompting guidelines, or workflow practices do you follow (e.g., 'Plan mode before multi-file edits', 'Never commit directly')?"
   - For each item, run:
     ```bash
     stash have "[practice] <rule statement>"
     ```

4. **Custom Models:**
   - Prompt: "Are there any fine-tunes, external endpoints, or custom models you use regularly?"
   - For each item, run:
     ```bash
     stash have "[model] <model name or Hugging Face URL>"
     ```

5. **Optional: spoken transcripts (off by default):**
   - Prompt: "When agy and the Gemini API both fail on a reel, stash falls back to a contact sheet. Want a local speech transcript added too? It installs faster-whisper (~150 MB) and downloads a ~460 MB model on first use."
   - Only if yes: install the extra the way stash was installed (repo checkout: `uv sync --extra whisper` in `apps/core`; uv tool: `uv tool install --reinstall "./apps/core[whisper]"`), then add `whisper = true` near the top of `$STASH_HOME/config.toml`, above any `[table]` (create the file if it is missing).

6. **Optional: burner cookies for blocked reels:**
   - Mention once: if Instagram blocks the logged-out embed page, stash can retry with yt-dlp using cookies from a **throwaway** Instagram account, never the user's main account. To enable, export that account's cookies in Netscape format to `$STASH_HOME/secrets/ig-cookies.txt`. If Instagram flags the account, stash stops using the cookies and writes `logs/burner_flagged`.

Print a summary of entries recorded into `inventory/manual/*.md` and verified in SQLite.
