# link-stash

A local-first system that turns tech reels, GitHub repos, Hugging Face models, and docs into a structured markdown library on your machine.

When you save links from Instagram reels or developer posts, they usually get lost in bookmarks without context. Link Stash downloads the reel, transcribes the audio, extracts on-screen text, identifies the tools or libraries mentioned, checks whether you already have something similar installed, and saves a markdown card to your local library.

It includes a Python CLI, background extractors, a local SQLite FTS5 search index, and a web app for browsing cards, reading notes, and watching saved reels.

## How it works

1. **Extract**: Grabs source metadata and media from Instagram reels, GitHub repositories, Hugging Face models/spaces, Notion pages, and PDFs.
2. **Analyze reels**: Transcribes speech, runs OCR on on-screen text, and identifies mentioned tools and links using Gemini or local frame analysis.
3. **Check inventory**: Scans your local environment (Ollama models, LM Studio cache, Hugging Face models, agent configs) to flag tools you already have before you save duplicates.
4. **Save markdown cards**: Writes human-readable `.md` files with YAML frontmatter to your local stash directory (`~/stash/library/`).
5. **Index and explore**: Keeps a disposable SQLite FTS5 index of titles, summaries, and backlinks, served locally to a web interface.

## Supported sources

- **Instagram reels**: Audio transcription, on-screen text detection, reel video preservation, poster thumbnails.
- **GitHub repositories**: Canonical owner/repo resolution, stars, topics, license, and detection of skills, plugins, or MCP servers.
- **Hugging Face**: Model architectures, parameter sizes, GGUF variants, datasets, and spaces.
- **Notion pages & PDFs**: Extracted text, markdown, and all outbound reference links.

## Architecture

This repository is organized as a monorepo:

```
stash/
  apps/
    core/             Python package (`stash`) managing extraction, storage, and CLI
    web/              React + Vite frontend for browsing, search, and notes
  docs/               Architecture specs and development milestone plans
  pnpm-workspace.yaml Monorepo configuration for frontend packages
```

### Data layout (`STASH_HOME`, defaults to `~/stash`)

Your stash is stored entirely on disk in plain files:

```
~/stash/
  config.toml         Paths, reel engine order, server port
  .env                API keys (GEMINI_API_KEY, GITHUB_TOKEN)
  inventory/          Auto-scanned and manually registered tools
  library/
    items/            Categorized markdown cards (models, tools, ui-ux, etc.)
    sources/          Raw reel video, transcripts, thumbnails, and JSON payloads
    pending.md        Items waiting on comment links or manual URLs
    rejected.md       Discarded suggestions
  .index/stash.db     Disposable SQLite index for full-text search and graph relations
```

## Getting started

### Prerequisites

- Python 3.14+ managed via [uv](https://docs.astral.sh/uv/)
- Node.js 20+ and [pnpm](https://pnpm.io/)
- `ffmpeg` on your PATH (for reel video processing and audio extraction)

### Core setup (Python)

```bash
cd apps/core
uv sync
uv run stash --help
```

### Web app setup (React + Vite)

```bash
pnpm install
pnpm --filter @stash/web dev
```

To build the static frontend:

```bash
pnpm --filter @stash/web build
```

## Running tests

```bash
# Backend tests (apps/core)
cd apps/core
uv run pytest

# Frontend tests (apps/web)
pnpm --filter @stash/web test
```

## License

MIT
