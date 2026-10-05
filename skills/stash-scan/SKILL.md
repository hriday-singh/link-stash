---
name: stash-scan
description: Force a rescan of installed tools, agent skills, and local models into inventory/auto/.
---

# `/stash-scan` — Refresh Auto Inventory

Use this skill when the user has installed or updated agent tools, plugins, MCP servers, or local models and wants an immediate refresh of `inventory/auto/`.

## Workflow

1. Execute a forced rescan:
   ```bash
   stash scan
   ```
2. The command will:
   - Walk Claude Code skills, plugins, agents, and MCP servers (`~/.claude`)
   - Walk shared agent skills (`~/.agents/skills`)
   - Walk Antigravity skills, plugins, and rules (`~/.gemini`)
   - Walk Codex skills and config (`~/.codex`)
   - Scan local model manifests for Ollama (`~/.ollama/models/manifests`)
   - Scan LM Studio model directories (`~/.lmstudio/models`)
   - Scan Hugging Face cache repositories (`~/.cache/huggingface/hub`)
   - Check presence for auxiliary agent tools (mem0, claude-mem, impeccable, caveman)
   - Update `inventory/auto/<tool>.md` files with timestamps
   - Reindex all detected entries into the SQLite `inventory` table
3. Print a summary table showing item counts detected across all tools.
