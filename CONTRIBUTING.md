# Contributing to Link Stash

First off, thank you for considering contributing to Link Stash!

Link Stash is an open-source, local-first system that transforms tech reels, GitHub repositories, Hugging Face models, and technical documentation into a structured, searchable markdown knowledge library.

---

## 1. Prerequisites

Before setting up the repository, make sure you have the following installed on your system:

- **Python 3.14+** managed via [uv](https://docs.astral.sh/uv/) (uv will automatically download and manage Python if needed).
- **Node.js 20+** and [pnpm](https://pnpm.io/) (v9 or v10).
- **ffmpeg** on your PATH (required for reel video extraction and audio processing).
- **Git**.

Optional tools:
- **GitHub CLI (`gh`)**: for automated GitHub token resolution (`gh auth token`).
- **Antigravity CLI (`agy`)**: for local vision/audio reel processing.

---

## 2. Monorepo Structure

```
stash/
├── apps/
│   ├── core/           # Python package (`stash`): extraction, store, index, services, CLI
│   └── web/            # React 19 + Vite frontend: card browsing, search, notes editor, graph
├── docs/               # Architecture specs and development milestone docs
├── skills/             # Portable agent skills for Claude Code and Antigravity
├── .github/            # GitHub Actions CI workflows and issue templates
└── package.json        # Monorepo root scripts and task runner
```

---

## 3. Quick Setup

Clone the repository and run the setup script:

```bash
git clone https://github.com/your-username/stash.git
cd stash

# One-step setup: installs Node packages, Python venv, global `stash` command, links agent skills
pnpm setup
```

Start both backend and frontend development servers concurrently:

```bash
pnpm dev
```

- **Backend API**: `http://127.0.0.1:8765`
- **Frontend App**: `http://localhost:5173` (proxies `/api` to the backend)

You can also run the CLI directly from the root using:
```bash
pnpm stash doctor
# or
./stash doctor      # macOS / Linux / WSL / Git Bash
# or
.\stash.ps1 doctor  # Windows PowerShell
```

---

## 4. Development Workflow

### Running Individual Services

```bash
# Run backend API server only
pnpm dev:api

# Run Vite frontend only
pnpm dev:web

# Run production build of the frontend
pnpm build
```

### Running Tests

We maintain 100% passing test suites across both Python and TypeScript. Always run tests before opening a pull request.

```bash
# Run both backend and frontend test suites
pnpm test

# Run Python backend tests only (pytest)
pnpm test:core

# Run React frontend tests only (vitest)
pnpm test:web
```

### Quality Gates: Linting, Formatting, and Type Checking

All code must pass strict type checking and linting without errors:

```bash
# Lint backend (Ruff) and frontend (ESLint)
pnpm lint

# Strict type checks across Python (Pyright strict) and TypeScript (tsc -b)
pnpm typecheck

# Format code (Ruff + Prettier)
pnpm format

# Verify production bundle budget (initial gzip <= 250 KB)
pnpm check:bundle
```

### Regenerating OpenAPI Client Types

When you update FastAPI routes or Pydantic schemas in `apps/core`:

```bash
pnpm gen:api
```

This exports the updated `apps/web/openapi.json` and updates `apps/web/src/api/schema.d.ts`.

---

## 5. Coding Standards

### Python (`apps/core`)
- Strict type hints everywhere; validated by Pyright in strict mode (`typeCheckingMode = "strict"`).
- Code style enforced by Ruff (format & lint).
- Atomic disk operations: Markdown cards are saved atomically with temporary file swaps and content hashes.
- Concurrency: All card writes must acquire the reentrant `write_lock`.

### TypeScript & React (`apps/web`)
- Strict TypeScript (`noImplicitAny`, strict null checks).
- **Design System Rules**: Zero hardcoded colors, pixel values, or arbitrary margins. Always use semantic CSS variables and tokens from `tokens.css`.
- Performance: Code-split routes, lazy load graph visualization (`sigma`), and ensure the initial gzip bundle stays under 250 KB.

---

## 6. Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation only changes
- `refactor:` A code change that neither fixes a bug nor adds a feature
- `test:` Adding missing tests or correcting existing tests
- `chore:` Changes to build process, dependency updates, or tool configurations

Examples:
- `feat(cli): add --compact flag to stash suggest`
- `fix(web): resolve wikilink parsing when title contains brackets`
- `docs: update quickstart instructions for Windows`

---

## 7. Submitting a Pull Request

1. Fork the repository and create your branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Make your changes adhering to the code standards.
3. Run the full validation suite:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   pnpm check:bundle
   ```
4. Push your branch to GitHub and open a Pull Request.
5. Provide a clear PR description detailing your changes, referencing any relevant issues.
