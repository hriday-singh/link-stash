# Context Window Debloating & Payload Sanitization Specification

## 1. Problem Statement & The Delicate Balance

Link Stash fetches diverse content from across the internet—Instagram captioned embeds, GitHub repositories, Hugging Face model cards, Notion workspaces, PDFs, and arbitrary web pages—and scans local development environments (Ollama, LM Studio, Claude Code, Antigravity, Codex).

Raw extraction outputs from web scrapers and system scanners are notoriously high in "junk tokens":
- **HTML Chrome & Boilerplate:** Navigation bars, footer links, cookie consent dialogs, tracking scripts (`<script>`), styling sheets (`<style>`), massive inline `<svg>` graphics, session tokens, and responsive UI wrappers.
- **Redundant Site Text:** "Sign up for GitHub", "Star this repo", "Follow on Twitter", breadcrumbs, and reaction emojis.
- **Unbounded Structures:** Deeply nested file trees, raw Git blob commits, massive CSS class strings, and whitespace padding.
- **Verbose System Manifests:** Multi-megabyte raw JSON payloads from local tool caches, full environment dumps, and duplicate file listings.

Injecting unsanitized scraper or scanner output directly into an LLM session rapidly consumes the context window, triggers attention degradation, increases latency and inference costs, and pushes earlier conversational instructions out of memory.

> [!CAUTION]
> **The Delicate Balance:** We cannot solve bloat with aggressive lossy summarization or blunt character cuts. Doing so risks stripping the exact technical substance users care about—precise repo URLs, parameter sizes (`7B`, `70B`), quantization tags (`Q4_K_M`, GGUF), package commands (`uvx`, `pip`), licenses, and tool identifiers.

This document defines the strict, invariant rules for sanitizing scraper and scanner payloads across the system.

---

## 2. Preservation Invariants (The "Never Remove" List)

Every sanitizer and debloating filter **MUST** preserve the following critical technical facts without exception:

| Category | Invariant Items | Why It Matters |
| --- | --- | --- |
| **Identifiers & Links** | Canonical URLs, GitHub repo paths (`owner/repo`), Hugging Face asset IDs (`org/model`), external doc citations | Broken or truncated URLs make saved stash cards useless. |
| **Technical Specs** | Parameter counts (`3B`, `8B`, `70B`), context window limits (`128k`, `1M`), benchmark scores, precision tags (`FP16`, `BF16`, `int4`) | Core differentiator between models and libraries. |
| **Quantization & Formats** | GGUF variant tags (`Q4_K_M`, `Q8_0`), Safetensors, AWQ, EXL2, ONNX, CoreML | Users need exact file names when cross-checking local models. |
| **Code & Commands** | Installation commands (`uv add`, `npx -y @...`, `pip install`), setup CLI lines, configuration blocks | Practical usage value of developer cards. |
| **Licenses** | Exact license names (MIT, Apache-2.0, AGPL-3.0, Llama-3-Community, Non-Commercial) | Legal and commercial suitability gating. |
| **Inventory Keys** | Normalized keys (`ollama:<name>:<tag>`, `skill:<name>`, `mcp:<name>`, `hf:<type>:<id>`) | Powers deduplication and overlap prevention against local tools. |
| **Mentions** | Extracted secondary links to GitHub repos, Hugging Face models, and websites | Drives 1-level follow-through discovery and cross-linking. |

---

## 3. Exclusion Matrix (The "Always Remove" List)

The following artifacts must be stripped immediately upon retrieval, **before** structured parsing or context ingestion:

1. **DOM & Markup Shells:**
   - `<script>` and `<style>` blocks (including inline attributes and CSS definitions).
   - Embedded SVG graphics (`<svg>...</svg>`) and base64 data URIs.
   - Header/navigation bars (`<nav>`, `<header>`, `.navbar`, `.site-header`).
   - Footers and copyright notices (`<footer>`, `.site-footer`).
   - Cookie banners, newsletter popups, GDPR notices, and login modals (`#cookie-notice`, `.consent-modal`, `.auth-wall`).

2. **GitHub Page Chrome:**
   - "Skip to content", "Sign in / Sign up", "Watch", "Fork", "Star" UI text.
   - Tab counts ("Pull requests 12", "Actions", "Projects", "Security", "Insights").
   - Raw commit hashes (e.g. `commit 7a8f9c...`), branch switcher menus, and pagination buttons.

3. **Hugging Face Page Chrome:**
   - Community tab discussions, automated PR notifications, likes counters, and leaderboard boilerplate.
   - Raw repository commit history and raw HTTP header tables.

4. **Whitespace & Formatting Bloat:**
   - Consecutive blank lines collapsed to at most two newlines (`\n\n`).
   - Consecutive inline spaces or tabs collapsed to a single space.
   - Deeply nested `<div>` wrappers stripped to plain semantic markdown/text.

5. **Audio & Video Transcript Noise:**
   - Repetitive filler words (`"um"`, `"uh"`, `"like"` when excessive), music notations (`[Music]`, `[Applause]`), and speech recognition artifacts.

---

## 4. Per-Source Sanitization Profiles

### A. Instagram Reels (`stash/extract/instagram.py` & `reel/`)

- **Raw Ingested Data:** Captioned embed HTML (`/embed/captioned/`), poster image, video mp4.
- **Debloating Actions:**
  - Strip Instagram embed SVG icons, "View more on Instagram", like/comment button markup.
  - Retain: Author handle, clean caption text, verified status, media CDN URLs with `oe` timestamp.
  - Reel transcript debloat: Remove timestamps unless separating speaker changes; remove automated transcription filler tags.
- **Context Envelope Size:** ≤ 4,000 characters of clean text + structured mention array.

### B. GitHub Repositories (`stash/extract/github.py`)

- **Raw Ingested Data:** HTML page scrape + raw content probes (`README.md`, `SKILL.md`, config files).
- **Debloating Actions:**
  - Strip GitHub DOM navigation, sticky headers, sidebar widget links, and contributor avatar lists.
  - Parse README markdown: preserve headings, description, install commands, architecture diagrams, benchmark tables, and outbound URLs; strip badge image URLs (e.g., Shields.io build status badges, codecov badges) and repetitive changelog archives.
  - Enforce README budget: Generous limit of 20,000 characters before truncating, ensuring installation, API reference, and feature lists are never cut short.
- **Context Envelope Size:** Normalized `GithubRecord` JSON (approx. 1,000–4,500 tokens).

### C. Hugging Face Assets (`stash/extract/hf.py`)

- **Raw Ingested Data:** Model card README, file tree list, Hub API JSON.
- **Debloating Actions:**
  - Do NOT dump the entire raw file tree. Filter file lists to `.gguf`, `.safetensors`, `config.json`, and `tokenizer.json`.
  - Extract exact quantization names (`Q4_K_M`, `Q5_K_S`) and parameter counts; drop file commit hashes, upload dates, and blob SHAs.
  - Model card markdown: Strip HF widget interaction code and YAML metadata duplicates; keep model description, intended use, architecture, prompt templates, and licensing.
- **Context Envelope Size:** Normalized `HfRecord` JSON (approx. 800–2,500 tokens).

### D. Notion Public Pages (`stash/extract/notion.py`)

- **Raw Ingested Data:** Rendered DOM from Scrapling `StealthyFetcher`.
- **Debloating Actions:**
  - Strip Notion UI shell: workspace icons, page action menus, "Duplicate to Notion", sidebar navigation, and comment widgets.
  - Convert document blocks to clean markdown (headings, bullet points, callout boxes).
  - Outbound link deduplication: Collect external links into a deduplicated list; drop internal `notion.so/` workspace anchor links.
- **Context Envelope Size:** Generous limit of 16,000 characters of substantive text.

### E. Generic Web Pages & Documentation (`stash/extract/web.py`)

- **Raw Ingested Data:** Full HTML document from Scrapling `Fetcher` / `StealthyFetcher`.
- **Debloating Actions:**
  - Strip all `<script>`, `<style>`, `<nav>`, `<footer>`, `<aside>`, `<form>`, and modal tags.
  - Extract `<title>`, `<meta name="description">`, and OpenGraph tags.
  - Readability filtering: Extract only the `<article>`, `<main>`, or core content container.
  - Outbound link filtering: Discard internal site links (same domain); retain only external outbound links, especially GitHub and Hugging Face references.
  - Generous text cap: Up to 16,000 characters of substantive body text to capture complete documentation pages and articles without losing nuance.
- **Context Envelope Size:** Normalized `WebRecord` JSON (approx. 1,500–3,500 tokens).

### F. PDFs (`stash/extract/pdf.py`)

- **Raw Ingested Data:** PyMuPDF text stream and hyperlink annotations.
- **Debloating Actions:**
  - Strip repetitive running headers and footers across page boundaries (e.g. repeated page numbers, journal copyright lines).
  - Extract embedded hyperlink annotations directly via `page.get_links()`.
  - Generous text cap: Up to 24,000 characters (Abstract, Introduction, Architecture, Method, Evaluation, Conclusion) to preserve research paper depth.
- **Context Envelope Size:** Normalized `PdfRecord` JSON (approx. 2,500–5,000 tokens).

### G. Local Inventory Scanners (`stash/scanners.py` & `inventory/`)

- **Raw Ingested Data:** Manifest directories (`.ollama/models/manifests`), Hugging Face cache dirs (`~/.cache/huggingface/hub`), LM Studio models, Claude/Gemini plugin JSON files.
- **Debloating Actions:**
  - Never emit raw file paths, inode data, layer hashes, or download manifests to the agent context.
  - Compress every installed item into a compact tuple: `(kind, name, key)`.
    - Example: `("model", "llama3.2:3b", "ollama:llama3.2:3b")`
    - Example: `("mcp", "context7", "mcp:context7")`
  - When comparing candidate links against inventory:
    - Pass the **top 12 overlap candidates** (ranked via RapidFuzz) to the triage prompt rather than the entire 500+ item inventory.
- **Context Envelope Size:** Overlap candidates payload ≤ 600 tokens per triage step.

---

## 5. Token Budgets & Guardrails

Generous limits ensure long-form technical documentation, deep model cards, and comprehensive READMEs are retained:

| Stage / Data Structure | Maximum Text Size | Target Token Equivalent | Action on Exceeding |
| --- | --- | --- | --- |
| **`WebRecord.text`** | 16,000 chars | ~3,500 tokens | Semantic truncate with `[...truncated]` marker |
| **`NotionRecord.text`** | 16,000 chars | ~3,500 tokens | Semantic truncate with `[...truncated]` marker |
| **`PdfRecord.text`** | 24,000 chars | ~5,000 tokens | Keep first 18k + last 6k chars |
| **`GithubRecord.readme`** | 20,000 chars | ~4,500 tokens | Keep Overview, Setup, Features; drop bottom |
| **`SourceDoc.caption`** | 4,000 chars | ~800 tokens | Truncate |
| **Inventory Prompt Slice** | Top 12 matches | ~500 tokens | Filtered by fuzzy similarity threshold (> 60%) |
| **Triage Card Candidate** | Full card spec | ~800 tokens | Standard structured YAML + summary |

---

## 6. Implementation Architecture

The debloating rules are enforced at two boundaries:

```
[Remote Web Page / File]
          │
          ▼
   Scrapling Fetch
          │
          ▼
┌───────────────────────────────────────────────┐
│ 1. Raw Sanitizer (stash/extract/sanitize.py)  │
│    - Strip <script>, <style>, <nav>, SVG      │
│    - Remove boilerplate & repetitive spaces   │
│    - Enforce character caps & link extraction │
└───────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────┐
│ 2. Structured Normalization (Record Models)   │
│    - WebRecord, GithubRecord, HfRecord        │
│    - Compact key metadata + mentions list     │
└───────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────┐
│ 3. Storage & Context Isolation                │
│    - Full raw response saved to sources/<id>/ │
│    - ONLY sanitized, high-density markdown    │
│      card enters LLM / Agent context window   │
└───────────────────────────────────────────────┘
```

1. **Raw Storage Isolation:** The complete raw JSON (`raw.json`) and raw media remain archived on disk under `STASH_HOME/library/sources/<key>/` for offline provenance.
2. **Context Window Shielding:** The CLI, Agent Skills, and API endpoints **NEVER** dump the unparsed `raw.json` into the LLM chat history. Only the clean, dense markdown cards (`library/items/`) or compact triage summaries are presented to the agent.

---

## 7. Verification & Automated Testing

To ensure debloating does not accidentally discard relevant technical data:

1. **Preservation Unit Tests:** Verify that sanitize functions retain model parameter tokens (e.g. `8B`, `70B`), quantization suffixes (`.gguf`), code blocks, and all outbound URLs.
2. **Boilerplate Stripping Tests:** Verify that `<script>`, `<style>`, navigation bars, and SVG markup are 100% removed from test fixtures.
3. **Budget Assertion Tests:** Assert that no generated `SourceDoc` or `WebRecord` text exceeds its allocated character cap.
