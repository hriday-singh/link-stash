"""`stash check`: exact key hits in library, inventory and rejects, plus overlap candidates.

Pure read unless `live` is set (then one network probe, see services/health.py).
The agent judges the candidates (same thing / same job / different).
"""

import sqlite3
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, model_validator
from rapidfuzz import fuzz, utils

from stash.services.health import Health, probe
from stash.store.index import connect
from stash.store.models import InventoryEntry, RejectEntry

MIN_SCORE = 75
MAX_CANDIDATES = 10
TAG_BONUS = 10


class CheckInput(BaseModel):
    name: str = ""
    title: str = ""
    kind: str | None = None
    key: str | None = None
    url: str | None = None
    tags: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _sync_title_name(cls, data: object) -> object:
        if isinstance(data, dict):
            d: dict[str, object] = dict(data)  # type: ignore[reportUnknownArgumentType]
            if "title" in d and not d.get("name"):
                d["name"] = d["title"]
            elif "name" in d and not d.get("title"):
                d["title"] = d["name"]
            return d
        return data


class CardHit(BaseModel):
    key: str
    title: str
    slug: str
    category: str
    path: str


class OverlapMatch(BaseModel):
    source: Literal["card", "inventory"]
    key: str | None
    name_or_title: str
    kind: str
    where: str  # card category or inventory origin
    score: float
    shared_tags: list[str] = Field(default_factory=list[str])


Candidate = OverlapMatch  # alias for backwards compatibility


class CheckResult(BaseModel):
    status: Literal[
        "new", "duplicate_library", "duplicate_inventory", "previously_rejected", "overlap"
    ]
    existing_slug: str | None = None
    existing_category: str | None = None
    existing_origin: str | None = None
    reject_reason: str | None = None
    reject_date: str | None = None
    card: CardHit | None = None
    inventory: InventoryEntry | None = None
    reject: RejectEntry | None = None
    overlaps: list[OverlapMatch] = Field(default_factory=list[OverlapMatch])
    candidates: list[OverlapMatch] = Field(default_factory=list[OverlapMatch])
    health: Health | None = None


def _group(kind: str | None) -> str:
    # ponytail: models and practices only compare among themselves; repo/tool/mcp/skill/plugin
    # all do "a job", so a skill can overlap a repo. Finer groups when this proves noisy.
    return kind if kind in ("model", "practice") else "thing"


def _norm_url(url: str) -> str:
    return url.strip().rstrip("/").lower()


def name_score(a: str, b: str) -> float:
    """token_set_ratio, scaled down when one name has under half the words of the other.

    Plain token_set_ratio scores "design" vs "awesome-system-design-resources" at 100
    because one word is a subset of the other. Below a 1:2 word ratio the score is scaled
    by sqrt(ratio): "shadcn" vs "shadcn/ui" stays 100, that pair drops to 50.
    """
    # ponytail: word-count heuristic, not semantic; same-job matches come from shared tags.
    ta = utils.default_process(a).split()
    tb = utils.default_process(b).split()
    if not ta or not tb:
        return 0.0
    ratio = min(len(ta), len(tb)) / max(len(ta), len(tb))
    scale = 1.0 if ratio >= 0.5 else ratio**0.5
    return fuzz.token_set_ratio(a, b, processor=utils.default_process) * scale


def _candidates(db: sqlite3.Connection, item: CheckInput) -> list[OverlapMatch]:
    query_name = item.title or item.name
    group = _group(item.kind)
    tags = set(item.tags)
    out: list[OverlapMatch] = []
    for r in db.execute("SELECT key, title, kind, category FROM cards"):
        if r["key"] == item.key or _group(r["kind"]) != group:
            continue
        score = name_score(query_name, r["title"])
        card_tags = {t[0] for t in db.execute("SELECT tag FROM tags WHERE key = ?", (r["key"],))}
        shared = sorted(tags & card_tags)
        # A shared tag means "same job" even when the names have nothing in common.
        if score >= MIN_SCORE or shared:
            out.append(
                OverlapMatch(
                    source="card",
                    key=r["key"],
                    name_or_title=r["title"],
                    kind=r["kind"],
                    where=r["category"],
                    score=round(score + TAG_BONUS * len(shared), 1),
                    shared_tags=shared,
                )
            )
    for r in db.execute("SELECT key, name, kind, origin FROM inventory"):
        if (item.key and r["key"] == item.key) or _group(r["kind"]) != group:
            continue
        score = name_score(query_name, r["name"])
        if score >= MIN_SCORE:
            out.append(
                OverlapMatch(
                    source="inventory",
                    key=r["key"],
                    name_or_title=r["name"],
                    kind=r["kind"],
                    where=r["origin"],
                    score=round(score, 1),
                )
            )
    out.sort(key=lambda c: -c.score)
    return out[:MAX_CANDIDATES]


def check_item(home: Path, item: CheckInput, *, live: bool = False) -> CheckResult:
    """Order: library key, library URL, inventory key, reject key; candidates always included.

    `live` adds a reachability probe of `item.url` (dead link, archived repo, etc.).
    """
    result = _check(home, item)
    if live and item.url:
        result.health = probe(item.url)
    return result


def _check(home: Path, item: CheckInput) -> CheckResult:
    if item.url and not item.key:
        from stash.services.inventory import key_for_url

        try:
            inferred_key, inferred_kind, inferred_name = key_for_url(item.url)
            item.key = inferred_key
            item.kind = item.kind or inferred_kind
            if not (item.title or item.name):
                item.name = inferred_name
        except Exception:
            pass

    db = connect(home)
    try:
        candidates = _candidates(db, item)
        row = None
        if item.key:
            row = db.execute("SELECT * FROM cards WHERE key = ?", (item.key,)).fetchone()
        if row is None and item.url:
            url = _norm_url(item.url)
            row = next(
                (
                    r
                    for r in db.execute("SELECT * FROM cards WHERE url IS NOT NULL")
                    if _norm_url(r["url"]) == url
                ),
                None,
            )
        if row is not None:
            hit = CardHit(
                key=row["key"],
                title=row["title"],
                slug=row["slug"],
                category=row["category"],
                path=row["path"],
            )
            return CheckResult(
                status="duplicate_library",
                existing_slug=row["slug"],
                existing_category=row["category"],
                card=hit,
                overlaps=candidates,
                candidates=candidates,
            )
        if item.key:
            inv = db.execute("SELECT * FROM inventory WHERE key = ?", (item.key,)).fetchone()
            if inv:
                entry = InventoryEntry(
                    key=inv["key"], name=inv["name"], kind=inv["kind"], origin=inv["origin"]
                )
                return CheckResult(
                    status="duplicate_inventory",
                    existing_origin=inv["origin"],
                    inventory=entry,
                    overlaps=candidates,
                    candidates=candidates,
                )
            rej = db.execute("SELECT * FROM rejects WHERE key = ?", (item.key,)).fetchone()
            if rej:
                entry = RejectEntry(key=rej["key"], date=rej["date"], reason=rej["reason"])
                return CheckResult(
                    status="previously_rejected",
                    reject_reason=rej["reason"],
                    reject_date=str(rej["date"]),
                    reject=entry,
                    overlaps=candidates,
                    candidates=candidates,
                )
        if candidates:
            return CheckResult(
                status="overlap",
                overlaps=candidates,
                candidates=candidates,
            )
        return CheckResult(status="new", overlaps=[], candidates=[])
    finally:
        db.close()
