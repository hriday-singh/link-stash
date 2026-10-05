"""Data models and type definitions for stash markdown store and index."""

from datetime import date, datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SEED_CATEGORIES: tuple[str, ...] = (
    "models",
    "skills-plugins",
    "mcp-servers",
    "repos-tools",
    "ui-ux",
    "practices",
)

Kind = Literal[
    "repo",
    "model",
    "skill",
    "plugin",
    "mcp",
    "tool",
    "ui_ref",
    "practice",
    "link",
]


class Mention(BaseModel):
    """A mentioned entity in a source document."""

    kind: str
    name: str
    url: str | None = None
    at: str | None = None


class Card(BaseModel):
    """Frontmatter metadata for an item card."""

    model_config = ConfigDict(populate_by_name=True)

    schema_: int = Field(1, alias="schema")
    key: str
    title: str
    category: str
    kind: Kind
    tags: list[str] = Field(default_factory=list)
    added: date
    url: str | None = None
    sources: list[str] = Field(default_factory=list)
    facts: dict[str, object] = Field(default_factory=dict)
    features: list[str] = Field(default_factory=list)
    overlaps: list[str] = Field(default_factory=list)


class SourceDoc(BaseModel):
    """A captured source record (e.g. Instagram reel, GitHub repo)."""

    key: str
    platform: str
    creator: str | None = None
    url: str
    stage: str
    engine: str | None = None
    fetched_at: datetime | None = None
    caption: str | None = None
    summary: str | None = None
    transcript: str | None = None
    on_screen_text: list[str] = Field(default_factory=list[str])
    mentions: list[Mention] = Field(default_factory=list[Mention])
    cta: dict[str, object] | None = None
    video: Path | None = None
    thumb: Path | None = None


class PendingItem(BaseModel):
    """A pending item requiring follow-up (e.g. comment-for-link CTA or blocked fetch)."""

    id: str
    kind: Literal["cta", "blocked"]
    source_key: str | None = None
    instruction: str
    url: str | None = None
    status: Literal["open", "ready"] = "open"
    added: date


class RejectEntry(BaseModel):
    """A rejected item entry."""

    key: str
    date: date
    reason: str


class InventoryEntry(BaseModel):
    """An installed agent tool, model, or manually recorded inventory item."""

    key: str | None = None
    name: str
    kind: str
    origin: str
