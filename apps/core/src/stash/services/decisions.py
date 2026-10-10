"""library/decisions.jsonl: what triage proposed vs what the user decided.

The `/stash` skill distills this log into `library/preferences.md` rules; `stash prefs`
summarizes it so the agent never reads raw history.
"""

from collections import Counter
from datetime import date
from pathlib import Path
from typing import Literal, get_args

from pydantic import BaseModel, Field

from stash.errors import Invalid
from stash.services.rejects import list_rejects
from stash.store.index import connect
from stash.store.models import Bucket

Final = Literal["save", "reject"]
Proposed = Literal["save", "reject", "ask"]

LIKED_MIN_SAVES = 3
LIKED_MIN_RATE = 0.8
RECENT_OVERRIDES = 10


class Decision(BaseModel):
    date: date
    key: str
    final: Final
    proposed: Proposed
    bucket: Bucket | None = None
    proposed_bucket: Bucket | None = None
    category: str | None = None
    tags: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    reason: str | None = None

    @property
    def is_override(self) -> bool:
        """An `ask` row is a decision, not an override; a moved bucket is."""
        if self.proposed != "ask" and self.proposed != self.final:
            return True
        return bool(
            self.final == "save"
            and self.proposed_bucket
            and self.bucket
            and self.proposed_bucket != self.bucket
        )


def _path(home: Path) -> Path:
    return home / "library" / "decisions.jsonl"


def rules_path(home: Path) -> Path:
    """Agent-maintained, user-editable rules distilled from the log."""
    return home / "library" / "preferences.md"


def check_proposed(proposed: str | None, proposed_bucket: str | None) -> None:
    """Fail fast on bad values before anything is saved."""
    if proposed is not None and proposed not in get_args(Proposed):
        raise Invalid(f"invalid proposed: {proposed!r}, expected save, reject or ask")
    if proposed_bucket is not None and proposed_bucket not in get_args(Bucket):
        raise Invalid(f"invalid proposed bucket: {proposed_bucket!r}")


def log_decision(home: Path, decision: Decision) -> None:
    # ponytail: plain append, one short line per call; add write_lock if concurrent writers appear
    path = _path(home)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(decision.model_dump_json(exclude_none=True) + "\n")


def read_decisions(home: Path) -> list[Decision]:
    path = _path(home)
    if not path.is_file():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    return [Decision.model_validate_json(ln) for ln in lines if ln.strip()]


def liked_tags(decisions: list[Decision]) -> list[str]:
    """Tags with at least LIKED_MIN_SAVES saves and a save rate of LIKED_MIN_RATE."""
    saves: Counter[str] = Counter()
    total: Counter[str] = Counter()
    for d in decisions:
        for t in d.tags:
            total[t] += 1
            saves[t] += d.final == "save"
    return sorted(
        t for t, n in saves.items() if n >= LIKED_MIN_SAVES and n / total[t] >= LIKED_MIN_RATE
    )


def prefs_summary(home: Path, seed: bool = False) -> dict[str, object]:
    decisions = read_decisions(home)
    overrides = [d for d in decisions if d.is_override]
    by_category: dict[str, dict[str, int]] = {}
    for d in decisions:
        if d.category:
            row = by_category.setdefault(d.category, {"saved": 0, "rejected": 0})
            row["saved" if d.final == "save" else "rejected"] += 1
    rules = rules_path(home)
    out: dict[str, object] = {
        "rules_path": str(rules),
        "rules": rules.read_text("utf-8") if rules.is_file() else None,
        "decisions": len(decisions),
        "overrides": len(overrides),
        "override_rate": round(len(overrides) / len(decisions), 2) if decisions else 0.0,
        "recent_overrides": [
            d.model_dump(mode="json", exclude_none=True, exclude={"sources"})
            for d in overrides[-RECENT_OVERRIDES:]
        ],
        "by_category": by_category,
        "liked_tags": liked_tags(decisions),
    }
    if seed:
        out["library"] = _library_summary(home)
    return out


def _library_summary(home: Path) -> dict[str, object]:
    """Current library shape plus reject reasons, for the one-time rule seed."""
    con = connect(home)
    try:
        categories = dict(
            con.execute("SELECT category, count(*) FROM cards GROUP BY category").fetchall()
        )
        buckets = dict(
            con.execute(
                "SELECT coalesce(json_extract(frontmatter, '$.bucket'), 'none'), count(*) "
                "FROM cards GROUP BY 1"
            ).fetchall()
        )
        top_tags = [
            {"tag": t, "count": n}
            for t, n in con.execute(
                "SELECT tag, count(*) AS n FROM tags GROUP BY tag ORDER BY n DESC, tag LIMIT 15"
            ).fetchall()
        ]
    finally:
        con.close()
    return {
        "cards_by_category": categories,
        "cards_by_bucket": buckets,
        "top_tags": top_tags,
        "rejects": [{"key": r.key, "reason": r.reason} for r in list_rejects(home)],
    }
