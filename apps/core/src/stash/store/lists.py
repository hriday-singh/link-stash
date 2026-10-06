"""Line formats for the plain markdown lists: inventory, rejected.md, pending.md.

One entry per `- ` line. Any other line (headings, notes, blank) is left alone on rewrite.
"""

import re
from collections.abc import Callable
from datetime import date
from pathlib import Path

from stash.store.cards import write_atomic
from stash.store.models import InventoryEntry, PendingItem, RejectEntry

SEP = " — "

# - [kind] name — note (key: k)
_INV = re.compile(r"^\s*[-*]\s+(?:\[(?P<kind>[\w-]+)\]\s*)?(?P<rest>.+?)\s*$")
_KEY = re.compile(r"\s*\(key:\s*(?P<key>\S+?)\)$")
# - 2026-09-12 github:a/b — reason
_REJ = re.compile(
    r"^\s*[-*]\s+(?P<date>\d{4}-\d{2}-\d{2})\s+(?P<key>\S+)(?:\s+—\s*(?P<reason>.*))?$"
)
# - [open] p-1a2b cta ig:ABC 2026-10-06 — instruction (url: https://...)
_PEND = re.compile(
    r"^\s*[-*]\s+\[(?P<status>open|ready)\]\s+(?P<id>\S+)\s+(?P<kind>cta|blocked)\s+"
    r"(?P<source>\S+)\s+(?P<added>\d{4}-\d{2}-\d{2})\s+—\s*(?P<rest>.*)$"
)
_URL_SUFFIX = re.compile(r"\s*\(url:\s*(?P<url>\S+?)\)$")


def parse_inventory_line(line: str, origin: str) -> InventoryEntry | None:
    m = _INV.match(line)
    if not m:
        return None
    rest = m["rest"]
    key = None
    if k := _KEY.search(rest):
        key, rest = k["key"], rest[: k.start()]
    name = rest.split(SEP, 1)[0].strip()
    if not name:
        return None
    # ponytail: untagged hand-written lines count as tools
    return InventoryEntry(key=key, name=name, kind=m["kind"] or "tool", origin=origin)


def inventory_line(kind: str, name: str, key: str | None, note: str | None = None) -> str:
    line = f"- [{kind}] {name}"
    if note:
        line += f"{SEP}{note}"
    if key:
        line += f" (key: {key})"
    return line


def parse_reject_line(line: str) -> RejectEntry | None:
    m = _REJ.match(line)
    if not m:
        return None
    return RejectEntry(key=m["key"], date=date.fromisoformat(m["date"]), reason=m["reason"] or "")


def reject_line(e: RejectEntry) -> str:
    return f"- {e.date.isoformat()} {e.key}{SEP}{e.reason}"


def parse_pending_line(line: str) -> PendingItem | None:
    m = _PEND.match(line)
    if not m:
        return None
    rest, url = m["rest"], None
    if u := _URL_SUFFIX.search(rest):
        url, rest = u["url"], rest[: u.start()]
    return PendingItem(
        id=m["id"],
        kind=m["kind"],  # type: ignore[arg-type]
        source_key=None if m["source"] == "-" else m["source"],
        instruction=rest.strip(),
        url=url,
        status=m["status"],  # type: ignore[arg-type]
        added=date.fromisoformat(m["added"]),
    )


def pending_line(p: PendingItem) -> str:
    line = (
        f"- [{p.status}] {p.id} {p.kind} {p.source_key or '-'} {p.added.isoformat()}"
        f"{SEP}{' '.join(p.instruction.split())}"
    )
    if p.url:
        line += f" (url: {p.url})"
    return line


def parse_all[T](text: str, parse: Callable[[str], T | None]) -> list[T]:
    return [e for line in text.splitlines() if (e := parse(line)) is not None]


def read_lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines() if path.is_file() else []


def write_lines(home: Path, path: Path, lines: list[str]) -> None:
    """Caller holds write_lock. Writes atomically and reindexes the file."""
    from stash.store.index import reindex_path

    write_atomic(path, "\n".join(lines) + "\n" if lines else "")
    reindex_path(home, path)
