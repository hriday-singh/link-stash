# A6 Inventory: Plan

**Goal:** Automatic discovery and indexing of installed tools, agent skills, plugins, MCP servers, and local AI models (Ollama, LM Studio, Hugging Face cache), plus manual inventory management via `stash have`.
**Spec:** `docs/link-stash-spec.md` (Inventory, Automatic scan table, Manual files, Build order A6). Contract: `2026-10-05-library-app-00-overview.md` (`InventoryEntry`, `stash.services.inventory.have`).
**Stack:** stdlib (`pathlib`, `json`, `shutil`), `pyyaml`.

## Constraints
- Read-only on host tools: The scan NEVER modifies agent config files, CLI directories, or model weights.
- Missing paths or uninstalled tools are skipped gracefully and logged to `logs/scan.log` without raising errors.
- Automatic scan writes to `inventory/auto/<tool>.md` with `scanned_at` frontmatter.
- Manual inventory records in `inventory/manual/*.md` can be edited by hand, via `/stash-init`, or via `stash have`.
- Stale check: `stash scan --if-stale` skips execution if the newest `inventory/auto/*.md` is less than 24 hours old.
- Never commit; checkpoint after each task.

## Review focus
1. **Predator path resolution:** Expands `~` to the real user home (`C:\Users\clash` on Windows, `$HOME` on Unix) and handles forward/backward slashes.
2. **Missing tool tolerance:** If Ollama, LM Studio, or Codex is not installed, the scanner logs a line to `scan.log` and continues without failing the batch.
3. **Model name normalization:** Hugging Face cache folder `models--org--name` converts to `hf:model:org/name` key. Ollama tags (`qwen2.5:7b`) map to `ollama:qwen2.5:7b`.
4. **Byte-safe manual appends:** `stash have` appends a clean markdown bullet without corrupting existing manual files.
5. **Index synchronization:** Auto-scanned and manual entries are indexed into the SQLite `inventory` table on scan completion.

---

### Task 1: Inventory Models & Config
- **Files:** `apps/core/src/stash/inventory/models.py`, `apps/core/tests/test_inventory_models.py`.
- **Approach:**
  - Define `InventoryItem(name: str, kind: str, origin: str, key: str | None = None)`.
  - Add optional inventory path overrides to `Config` in `stash.config`.
  - Helper functions for reading/writing `inventory/auto/<tool>.md` with YAML frontmatter (`scanned_at`).
- **Tests:** Round-trip serialization of auto inventory markdown; path override validation.

### Task 2: Agent Tools & Skills Scanners
- **Files:** `apps/core/src/stash/inventory/scanners/agents.py`, `apps/core/tests/test_scanner_agents.py`.
- **Approach:**
  - Claude Code scanner: parses `~/.claude.json` (`mcpServers`), walks `~/.claude/skills/*/SKILL.md`, `~/.claude/plugins/`, `~/.claude/agents/`.
  - Shared Agent Skills: walks `~/.agents/skills/` and legacy `~/.agent/skills/`.
  - Antigravity scanner: reads `~/.gemini/config/mcp_config.json`, walks `~/.gemini/antigravity-cli/skills/`, `~/.gemini/config/skills/`, plugins.
  - Codex & others: reads `~/.codex/config.toml`, checks presence for `~/.claude-mem`, `~/.mem0`, `~/.impeccable`, `~/.caveman`.
- **Tests:** Mock filesystem fixtures representing installed skills, plugins, and MCP servers; assert extracted `InventoryItem` records.

### Task 3: Local AI Models Scanner
- **Files:** `apps/core/src/stash/inventory/scanners/models.py`, `apps/core/tests/test_scanner_models.py`.
- **Approach:**
  - Ollama: runs `ollama list` if binary exists; fallback scans manifests at `~/.ollama/models/manifests/`.
  - LM Studio: runs `lms ls` if binary exists; fallback scans `~/.lmstudio/models/<publisher>/<repo>/`.
  - Hugging Face cache: scans `~/.cache/huggingface/hub/` for `models--*` and `datasets--*` directory prefixes.
- **Tests:** Mock CLI output and directory structures; verify normalized model keys.

### Task 4: Inventory Service & `stash have`
- **Files:** `apps/core/src/stash/services/inventory.py`, `apps/core/tests/test_service_inventory.py`.
- **Approach:**
  - `scan_inventory(home: Path, force: bool = False) -> list[InventoryItem]`:
    - Checks 24-hour freshness unless `force=True`.
    - Runs all scanners; appends missing path notes to `logs/scan.log`.
    - Writes `inventory/auto/<tool>.md`.
    - Updates SQLite `inventory` table under `write_lock`.
  - `have(home: Path, text: str) -> InventoryEntry`:
    - Parses text, detects if it contains a URL or GitHub repo reference to extract identity key.
    - Determines target manual file (e.g. `inventory/manual/tools.md` or `ui-ux.md`).
    - Appends `- [<kind>] <name> (key: <key>)` under lock and indexes entry.
- **Tests:** 24h freshness skip; forced rescan; `have` URL key resolution; manual markdown append.

### Task 5: CLI `stash scan` and `stash have`
- **Files:** `apps/core/src/stash/cli/inventory.py`, `apps/core/tests/test_cli_inventory.py`.
- **Approach:**
  - `stash scan [--if-stale]`: runs `scan_inventory`, prints summary JSON count per tool.
  - `stash have <text>`: runs `have`, prints JSON `InventoryEntry`.
- **Tests:** CLI tests for scan, freshness flag, and have command with both URL and plain text arguments.
- **Done:** `stash scan` runs against real machine paths; index contains installed skills and models; unit tests, ruff, pyright green.
