"""Pydantic models for structured reel analysis."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MentionKind = Literal[
    "repo", "model", "skill", "plugin", "mcp", "tool", "ui_ref", "practice", "link"
]
UrlSource = Literal["on_screen", "spoken", "caption", "inferred"]
EvidenceType = Literal["spoken", "on_screen", "caption"]
TranscriptSource = Literal["audio", "burned_subtitles", "none"]
CtaType = Literal["comment", "link_in_bio", "url", "none"]
EngineName = Literal["agy-host", "agy-headless", "gemini-api", "frames"]
ConfidenceLevel = Literal["high", "medium", "low"]


class ReelMention(BaseModel):
    """An independently installable, usable, or bookmarkable entity mentioned in the reel."""

    model_config = ConfigDict(extra="forbid")

    kind: MentionKind
    name: str
    url: str | None = None
    url_source: UrlSource | None = None
    evidence: EvidenceType = "on_screen"
    at: str | None = None


class ReelCta(BaseModel):
    """Call-to-action detected in the reel or caption (e.g. comment-for-link)."""

    model_config = ConfigDict(extra="forbid")

    type: CtaType = "none"
    keyword: str | None = None
    what_you_get: str | None = None


class ReelRecord(BaseModel):
    """Normalized structured understanding of a reel video and its caption."""

    model_config = ConfigDict(extra="forbid")

    summary: str
    spoken_language: str | None = None
    transcript: str | None = None
    transcript_source: TranscriptSource = "none"
    on_screen_text: list[str] = Field(default_factory=list[str])
    mentions: list[ReelMention] = Field(default_factory=list[ReelMention])
    features: dict[str, list[str]] = Field(default_factory=dict[str, list[str]])
    takeaways: list[str] = Field(default_factory=list[str])
    cta: ReelCta | None = None
    engine: EngineName
    confidence: ConfidenceLevel = "high"
