---
name: stash-init
description: Guided or bulk brain dump into inventory/manual/ for tools, UI references, and practices.
---

# `/stash-init` — Inventory Onboarding & Brain Dump

Use this skill to help the user perform an initial inventory brain dump or expand their manual inventory across tools, UI references, custom models, and engineering practices.

## Workflow

### 1. Show Auto-Scanned Baseline First
Always start by ensuring the inventory is fresh and showing what Stash already detected:
```bash
stash scan --if-stale
```
Display a concise summary so the user knows what tools, agent plugins, skills, and models are already indexed, and what remains to be captured:
- **Auto-scanned:** Claude Code & Antigravity plugins, constituent skills, local models (Ollama, HF), dev tools
- **Missing / Manual:** UI & UX references, custom engineering rules, and unscanned external utilities

### 2. Ingestion Modes

#### Mode A: Brain Dump (Fast / Default if user provides bulk text)
If the user provides a freeform dump, list of URLs, or text from other agents:
1. Parse all categories at once:
   - `[tool] <name> — <description> <optional_url>`
   - `[ui_ref] <name> — <description> <optional_url>`
   - `[practice] <rule statement>`
   - `[model] <name or URL>`
2. Preserve user nuances and verdicts in the note (e.g. `— preferred scroll engine`, `— only free blocks`, `— main icon kit`).
3. Ingest all items in a single batch via stdin:
   ```bash
   stash have -
   ```
   Pass the lines via stdin. Each line follows `[kind] Name — Note (optional URL)`.

#### Mode B: Guided Step-by-Step (If user starts empty or asks for guidance)
Step through one category at a time:
1. **Repositories & Tools:**
   - Prompt: "What CLI tools, dev apps, or utilities do you use that aren't auto-scanned?"
2. **UI & UX References:**
   - Prompt: "What design systems, UI kits, icon sets, or frontend component references do you regularly build with or refer to (e.g., shadcn/ui, Lenis, Motion, Lucide)?"
3. **Engineering Practices:**
   - Prompt: "What engineering rules or workflow practices do you follow (e.g., 'Plan before building', 'Never commit directly')?"
4. **Custom Models:**
   - Prompt: "Are there any fine-tunes, external endpoints, or custom models you use regularly?"
5. **Optional: Spoken Transcripts (off by default):**
   - Prompt: "When video engines fail on a reel, stash falls back to a contact sheet. Want a local speech transcript added too? (installs faster-whisper ~150 MB + ~460 MB model)."

### 3. Verification & Summary
Print a clean summary of entries recorded into `inventory/manual/*.md` and verified in SQLite.
