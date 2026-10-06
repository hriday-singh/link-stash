---
name: stash-suggest
description: Consult Link Stash for relevant installed tools, saved library cards, or practices before installing new packages or planning features.
---

# `/stash-suggest` — Stash Consultation & Discovery

Use this skill when:
- The user says **"use stash"**, **"check stash"**, or asks to research from their saved tools/practices.
- Planning a feature or component and wanting to see if a tool, UI kit, or architectural practice already exists in stash.
- Deciding on a third-party dependency (npm/pip) to avoid installing duplicates when a tool or reference is already present.

## Usage

```bash
stash suggest "<task or keywords>"
```

Options:
- `--text`: Output formatted markdown directly for easy terminal review.
- `--category <category>`: Filter specifically for `ui-ux`, `repos-tools`, `practices`, `models`, etc.
- `--kind <kind>`: Filter specifically for `tool`, `ui_ref`, `practice`, `skill`, `mcp`, `model`.
- `--limit <n>`: Maximum suggestions per bucket (default: 5).

### Examples
```bash
# Researching UI animation components
stash suggest "ui animation react"

# Checking for scraping/fetching tools
stash suggest "web scraper"

# Looking up prompting or design practices
stash suggest "prompting guidelines" --category practices

# Quick interactive reading in the terminal
stash suggest "smooth scrolling" --text
```

## Workflow for AI Agents

1. **Query Stash First**: Run `stash suggest "<task keywords>"`.
2. **Inspect the Output**:
   - **`found == true`**:
     - **`installed`**: Tools, skills, MCP servers, or models already on the machine or in manual inventory. Prefer using these before reaching for external dependencies!
     - **`cards`**: Saved library cards (repositories, component kits, models). Check the provided URLs, tags, and install snippets.
     - **`practices`**: Guidelines and rules from your stash (e.g. UI prompting rules, token standards, architecture constraints). Incorporate them into your plan.
   - **`found == false`**:
     - Nothing relevant exists in your stash. **Immediately skip** and proceed to external web research or standard libraries without hesitation.
