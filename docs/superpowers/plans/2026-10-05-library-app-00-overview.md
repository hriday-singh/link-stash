# Link Stash Library App: Plan Overview (B0–B6)

**Spec:** [docs/library-app-spec.md](../../library-app-spec.md) (part 2). Core spec: [docs/link-stash-spec.md](../../link-stash-spec.md) (part 1).

Seven plans, one per milestone. Each one ships working, testable software on its own and starts only when the one before it is approved.

| Plan | Milestone | Ships | Gate |
| --- | --- | --- | --- |
| [b0-design](2026-10-05-library-app-b0-design.md) | B0 Visual design | `apps/web` scaffold, `tokens.css`, theme, Tile/GeneratedTile/CategoryPill, static mock | You approve tokens + mock |
| [b1-api](2026-10-05-library-app-b1-api.md) | B1 Serve and API | `stash serve`, every endpoint, SSE, OpenAPI → TS types | API tests pass; CLI save emits `card.changed` |
| [b2-shell](2026-10-05-library-app-b2-shell.md) | B2 Shell, grid, search | Router, sidebar/drawer, Lenis, virtual grid, Feed/category/search, Ctrl+K, filters, live sync | Every card reachable by sidebar, palette, filters at 375 and 1280 px |
| [b3-card](2026-10-05-library-app-b3-card.md) | B3 Card page | Rendered body, Notes editor + autosave + 409, properties form, reject | Concurrent app + VS Code edits never lose an edit |
| [b4-stash-views](2026-10-05-library-app-b4-stash-views.md) | B4 Stash views | Sources + player, Pending, Rejected, Inventory, brand logos | Pending resolved in app is picked up by next `/stash` |
| [b5-graph](2026-10-05-library-app-b5-graph.md) | B5 Backlinks, graph | Link panels, local graph, global graph | Reel with 3 cards shows expected links in both graphs |
| [b6-polish](2026-10-05-library-app-b6-polish.md) | B6 Polish | Shared transition, Motion reorder, morphicons, torph, theme cord, checks | 4 checks pass |

## Precondition: core milestones A1–A7

No code exists yet. B0 can start any time (frontend only). **B1 and later need A4 and A7 done.** B1 imports the core through the contract below. When writing the A4/A7 plans, make them produce exactly these names; if they ship different names, fix the imports in B1 only.

### Core contract consumed by B1 (must exist after A7)

```python
# stash.config
class Config(BaseModel):
    home: Path
    port: int = 8765
    category_colors: dict[str, str] = {}   # [category_colors] table in config.toml
    web_dist: Path | None = None           # override for apps/web/dist
def load_config(home: Path | None = None) -> Config   # None -> STASH_HOME env, else ~/stash

# stash.errors
class StashError(Exception):
    def __init__(self, code: str, message: str, details: dict[str, object] | None = None): ...
    code: str; message: str; details: dict[str, object]
class NotFound(StashError):     # code "not_found";    __init__(message, details=None)
class Conflict(StashError):     # code "conflict";     __init__(message, details=None)
class Invalid(StashError):      # code "invalid";      __init__(message, details=None)
class LockTimeout(StashError):  # code "lock_timeout"; __init__(message, details=None)

# stash.store.models
SEED_CATEGORIES: tuple[str, ...] = ("models", "skills-plugins", "mcp-servers", "repos-tools", "ui-ux", "practices")
Kind = Literal["repo", "model", "skill", "plugin", "mcp", "tool", "ui_ref", "practice", "link"]
class Card(BaseModel):            # frontmatter; model_dump(by_alias=True) round-trips
    schema_: int = Field(1, alias="schema"); key: str; title: str; category: str; kind: Kind
    tags: list[str] = []; added: date; url: str | None = None; sources: list[str] = []
    facts: dict[str, object] = {}; features: list[str] = []; overlaps: list[str] = []
class Mention(BaseModel): kind: str; name: str; url: str | None = None; at: str | None = None
class SourceDoc(BaseModel):
    key: str; platform: str; creator: str | None; url: str; stage: str
    engine: str | None = None; fetched_at: datetime | None = None
    caption: str | None = None; summary: str | None = None; transcript: str | None = None
    on_screen_text: list[str] = []; mentions: list[Mention] = []; cta: dict[str, object] | None = None
    video: Path | None = None; thumb: Path | None = None    # relative to home
class PendingItem(BaseModel):
    id: str; kind: Literal["cta", "blocked"]; source_key: str | None; instruction: str
    url: str | None = None; status: Literal["open", "ready"]; added: date
class RejectEntry(BaseModel): key: str; date: date; reason: str
class InventoryEntry(BaseModel): key: str | None; name: str; kind: str; origin: str  # tool name or manual file stem

# stash.store.cards
def card_path(home: Path, category: str, slug: str) -> Path          # home/library/items/<category>/<slug>.md
def parse_card(text: str) -> tuple[Card, str]                        # (frontmatter, body)
def render_card(card: Card, body: str) -> str                        # byte-stable round trip
def content_hash(text: str) -> str                                   # same value the index stores
def write_atomic(path: Path, text: str) -> None                      # temp file + rename, utf-8, "\n"
def save_card(home: Path, card: Card, body: str, slug: str | None = None) -> Path  # lock + write + reindex

# stash.store.lock
@contextmanager
def write_lock(home: Path) -> Iterator[None]   # REENTRANT within one process; LockTimeout after 30 s

# stash.store.index  (tables and columns exactly as listed below)
def connect(home: Path) -> sqlite3.Connection  # row_factory=sqlite3.Row, schema current (rebuilds on mismatch)
def rebuild(home: Path) -> None                # takes the lock itself
def reindex_path(home: Path, path: Path) -> None
def remove_path(home: Path, path: Path) -> None

# stash.store.sources
def read_source(home: Path, key: str) -> SourceDoc      # NotFound if missing
def write_source(home: Path, doc: SourceDoc) -> Path    # lock + write source.md + reindex

# stash.store.watcher
async def watch(home: Path) -> AsyncIterator[set[tuple[watchfiles.Change, Path]]]
    # watches library/ and inventory/, ignores *.tmp, reindexes each batch BEFORE yielding it

# stash.services.rejects
def add_reject(home: Path, key: str, reason: str) -> RejectEntry
def remove_reject(home: Path, key: str) -> None          # NotFound if absent
# stash.services.pending
def list_pending(home: Path) -> list[PendingItem]
def add_pending(home: Path, item: PendingItem) -> None
def resolve_pending(home: Path, id: str, url: str) -> PendingItem   # NotFound if absent; status -> "ready"
# stash.services.inventory
def have(home: Path, text: str) -> InventoryEntry

# stash.cli
app: typer.Typer            # in stash/cli/__init__.py; entry point `stash = "stash.cli:app"`
```

**Index tables** (`.index/stash.db`):

| Table | Columns |
| --- | --- |
| `cards` | `key` PK, `path` (relative to home, POSIX), `slug` UNIQUE, `title`, `category`, `kind`, `added` (ISO date), `url`, `hash`, `mtime`, `frontmatter` (JSON text) |
| `sources` | `id` PK (= source key, e.g. `ig:DdpKWz1ymmi`), `platform`, `creator`, `url`, `stage`, `video`, `thumb` (relative to home or NULL), `engine`, `fetched_at` (ISO or NULL), `cta` (JSON or NULL) |
| `links` | `from_key`, `to_key`, `type` in `source` / `overlap` / `wikilink`. Unresolved wikilinks store `to_key = 'slug:<slug>'` |
| `tags` | `key`, `tag` |
| `inventory` | `key`, `name`, `kind`, `origin` |
| `rejects` | `key`, `date`, `reason` |
| `pending` | `id`, `kind`, `source_key`, `instruction`, `url`, `status`, `added` |
| `search` | FTS5: `key UNINDEXED`, `doc_type UNINDEXED` (`card` / `source`), `title`, `body`, `transcript`, `caption` |

## Global decisions made in these plans (approved Oct 5)

1. **Commit steps are checkpoints.** Your CLAUDE.md says never commit. Every "commit" step in these plans means: run lint + typecheck + tests, stop, list the changed files and a suggested conventional commit message. You commit.
2. **Token names follow shadcn** (`--background`, `--foreground`, `--muted-foreground`, `--primary`, `--destructive`, `--border`, ...) plus `--success`, `--warning`, `--cat-*`. The spec's `--bg`/`--fg` were examples; using shadcn's names means no shadcn primitive is edited.
3. **`POST /api/reindex` added.** The spec's palette has a "rebuild index" command but the API table had no endpoint for it.
4. **`until` filter added** next to `since`, for the spec's date-range filter.
5. **Tile → card shared transition uses the native View Transitions API** (B6), not Motion `layoutId`: the card route is code-split, so the tile unmounts before the card page mounts and Motion has nothing to animate from. Motion stays for grid reorder and list enter/exit. Update the spec's Motion row if you accept.
6. **Deps added beyond the spec:** `tomlkit` (write `config.toml` category colors without losing your comments), `zod` (URL search-param schemas), `culori` (dev only: contrast test), `react-markdown` (read-only body), `@fontsource-variable/geist*` (offline fonts).
