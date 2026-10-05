"""library/pending.md: comment-for-link and blocked items waiting on the user."""

import uuid
from datetime import date
from pathlib import Path

from stash.errors import Conflict, Invalid, NotFound
from stash.store.lists import parse_pending_line, pending_line, read_lines, write_lines
from stash.store.lock import write_lock
from stash.store.models import PendingItem, SourceDoc


def _path(home: Path) -> Path:
    return home / "library" / "pending.md"


def new_id() -> str:
    return f"p-{uuid.uuid4().hex[:8]}"


def cta_pending(doc: SourceDoc) -> PendingItem | None:
    """A `cta` pending only when the post asks for a comment and names nothing concrete.

    A CTA post whose content names its repos or tools is triaged normally instead.
    """
    keyword = (doc.cta or {}).get("keyword")
    if not keyword or doc.mentions:
        return None
    return PendingItem(
        id=new_id(),
        kind="cta",
        source_key=doc.key,
        instruction=f'Comment "{keyword}" on {doc.url} and paste the link you get by DM',
        added=date.today(),
    )


def list_pending(home: Path) -> list[PendingItem]:
    return [p for ln in read_lines(_path(home)) if (p := parse_pending_line(ln))]


def _no_space(field: str, value: str | None) -> None:
    # one line per item, space-separated: these fields cannot hold whitespace
    if value is not None and (not value or any(c.isspace() for c in value)):
        raise Invalid(f"{field} must be non-empty with no spaces", {field: value})


def add_pending(home: Path, item: PendingItem) -> None:
    _no_space("id", item.id)
    _no_space("source_key", item.source_key)
    _no_space("url", item.url)
    with write_lock(home):
        lines = read_lines(_path(home))
        if any((p := parse_pending_line(ln)) and p.id == item.id for ln in lines):
            raise Conflict(f"pending {item.id} already exists", {"id": item.id})
        write_lines(home, _path(home), [*lines, pending_line(item)])


def resolve_pending(home: Path, id: str, url: str) -> PendingItem:
    url = url.strip()
    _no_space("url", url)
    with write_lock(home):
        lines = read_lines(_path(home))
        for i, ln in enumerate(lines):
            p = parse_pending_line(ln)
            if p and p.id == id:
                done = p.model_copy(update={"url": url, "status": "ready"})
                lines[i] = pending_line(done)
                write_lines(home, _path(home), lines)
                return done
    raise NotFound(f"no pending item {id}", {"id": id})
