"""`stash save`: write a new card, or fold a new source into the card that already has the key."""

from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from stash.store.cards import parse_card, render_card, save_card, write_atomic
from stash.store.index import connect, reindex_path
from stash.store.lock import write_lock
from stash.store.models import Card
from stash.store.sources import mark_triaged


class SaveResult(BaseModel):
    status: Literal["saved", "merged"]
    key: str
    slug: str
    path: str  # relative to home, POSIX


def _union(a: list[str], b: list[str]) -> list[str]:
    return list(dict.fromkeys([*a, *b]))


def save(home: Path, card: Card, body: str, slug: str | None = None) -> SaveResult:
    """Key already in the library: only `sources` and `overlaps` grow and a missing `bucket`
    is filled; title, body and notes stay as they are. Otherwise a new card with a
    library-unique slug. Each source the card cites moves to stage `triaged`."""
    with write_lock(home):
        db = connect(home)
        try:
            row = db.execute("SELECT path FROM cards WHERE key = ?", (card.key,)).fetchone()
        finally:
            db.close()
        if row:
            path = home / row["path"]
            old, old_body = parse_card(path.read_text(encoding="utf-8"))
            merged = old.model_copy(
                update={
                    "sources": _union(old.sources, card.sources),
                    "overlaps": _union(old.overlaps, card.overlaps),
                    "bucket": old.bucket or card.bucket,
                }
            )
            if merged != old:
                write_atomic(path, render_card(merged, old_body))
                reindex_path(home, path)
            status: Literal["saved", "merged"] = "merged"
        else:
            path = save_card(home, card, body, slug)
            status = "saved"
        mark_triaged(home, card.sources)
    return SaveResult(
        status=status, key=card.key, slug=path.stem, path=path.relative_to(home).as_posix()
    )


save_card_service = save
