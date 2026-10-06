"""API request and response schemas for Link Stash library server."""

from typing import Literal, cast

from pydantic import BaseModel, Field

from stash.store.models import Bucket, Card, Kind, SourceDoc


class Page[T](BaseModel):
    items: list[T]
    next_cursor: str | None = None


class CardTile(BaseModel):
    key: str
    slug: str
    title: str
    category: str
    kind: Kind
    added: str
    url: str | None = None
    hash: str
    thumb_url: str | None = None
    platform: str | None = None
    tags: list[str] = Field(default_factory=list)
    bucket: Bucket | None = None


class CardDetail(BaseModel):
    slug: str
    card: Card
    body: str
    notes: str
    hash: str
    resolved: dict[str, str] = Field(default_factory=dict)


class CardPatch(BaseModel):
    base_hash: str
    category: str | None = None
    kind: Kind | None = None
    tags: list[str] | None = None
    notes: str | None = None


class CardRejectRequest(BaseModel):
    reason: str


class SourceRow(BaseModel):
    id: str
    platform: str
    creator: str | None = None
    url: str
    stage: str
    has_video: bool
    has_thumb: bool
    video_url: str | None = None
    thumb_url: str | None = None
    fetched_at: str | None = None


class SourceDetail(BaseModel):
    source: SourceDoc
    video_url: str | None = None
    thumb_url: str | None = None
    cards: list[dict[str, str]] = Field(default_factory=lambda: cast(list[dict[str, str]], []))


class SourceStagePatch(BaseModel):
    stage: Literal["fetched", "analyzed", "triaged"]


class CardLinks(BaseModel):
    backlinks: list[dict[str, str]] = Field(default_factory=lambda: cast(list[dict[str, str]], []))
    mentioned_by: list[dict[str, str]] = Field(
        default_factory=lambda: cast(list[dict[str, str]], [])
    )
    outgoing: list[dict[str, str]] = Field(default_factory=lambda: cast(list[dict[str, str]], []))


class GraphNode(BaseModel):
    id: str
    label: str
    category: str
    kind: str
    size: float = 10.0


class GraphEdge(BaseModel):
    source: str
    target: str
    type: Literal["wikilink", "source", "overlap"]


class GraphData(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=lambda: cast(list[GraphNode], []))
    edges: list[GraphEdge] = Field(default_factory=lambda: cast(list[GraphEdge], []))


class SearchHit(BaseModel):
    slug: str
    title: str
    category: str
    kind: str
    snippet: str


class CategoryMeta(BaseModel):
    name: str
    color: str
    count: int = 0


class TagMeta(BaseModel):
    tag: str
    count: int


class MetaCounts(BaseModel):
    cards: int
    sources: int
    pending: int
    rejected: int
    inventory: int


class MetaResponse(BaseModel):
    categories: list[CategoryMeta]
    tags: list[TagMeta]
    counts: MetaCounts
    version: str


class PendingResolveRequest(BaseModel):
    url: str


class InventoryAddRequest(BaseModel):
    text: str


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, object] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorDetail
