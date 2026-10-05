"""library/rejected.md: one `- <date> <key> — <reason>` line per rejected thing."""

from datetime import date
from pathlib import Path

from stash.errors import NotFound
from stash.store.lists import parse_reject_line, read_lines, reject_line, write_lines
from stash.store.lock import write_lock
from stash.store.models import RejectEntry


def _path(home: Path) -> Path:
    return home / "library" / "rejected.md"


def list_rejects(home: Path) -> list[RejectEntry]:
    return [e for ln in read_lines(_path(home)) if (e := parse_reject_line(ln))]


def add_reject(home: Path, key: str, reason: str) -> RejectEntry:
    """Reject `key`. Rejecting it again replaces the old date and reason."""
    entry = RejectEntry(key=key, date=date.today(), reason=" ".join(reason.split()))
    with write_lock(home):
        lines = read_lines(_path(home))
        kept = [ln for ln in lines if not ((e := parse_reject_line(ln)) and e.key == key)]
        write_lines(home, _path(home), [*kept, reject_line(entry)])
    return entry


def remove_reject(home: Path, key: str) -> None:
    with write_lock(home):
        lines = read_lines(_path(home))
        kept = [ln for ln in lines if not ((e := parse_reject_line(ln)) and e.key == key)]
        if len(kept) == len(lines):
            raise NotFound(f"{key} is not rejected", {"key": key})
        write_lines(home, _path(home), kept)
