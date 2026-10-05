"""library/queue.md: links waiting for triage, fed by the Instagram data export."""

import json
from pathlib import Path
from typing import cast

from stash.errors import Invalid
from stash.store.index import connect
from stash.store.keys import ig_key, parse_ig_url
from stash.store.lists import parse_queue_line, read_lines, write_lines
from stash.store.lock import write_lock


def _path(home: Path) -> Path:
    return home / "library" / "queue.md"


def _hrefs(node: object) -> list[str]:
    """Every `href` string anywhere in the export, in file order.

    ponytail: walks the whole tree instead of naming `saved_saved_media` / `saved_media` /
    `string_map_data`; Instagram renames those between export versions.
    """
    if isinstance(node, dict):
        d = cast(dict[object, object], node)
        out: list[str] = []
        for k, v in d.items():
            out += [v] if k == "href" and isinstance(v, str) else _hrefs(v)
        return out
    if isinstance(node, list):
        lst = cast(list[object], node)
        return [h for v in lst for h in _hrefs(v)]
    return []


def parse_ig_export(file: Path) -> list[str]:
    """Instagram post/reel URLs from saved_posts.json, deduped by key. Other hrefs are skipped."""
    try:
        data: object = json.loads(file.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise Invalid(f"cannot read Instagram export: {e}", {"path": str(file)}) from e
    urls: dict[str, str] = {}
    for href in _hrefs(data):
        try:
            kind, code = parse_ig_url(href)
        except Invalid:
            continue
        urls.setdefault(f"ig:{code}", f"https://www.instagram.com/{kind}/{code}/")
    return list(urls.values())


def list_queue(home: Path) -> list[str]:
    return [u for ln in read_lines(_path(home)) if (u := parse_queue_line(ln))]


def import_ig_export(home: Path, file: Path) -> int:
    """Queue every saved post not already sourced, cited by a card, rejected or queued."""
    urls = parse_ig_export(file)
    with write_lock(home):
        db = connect(home)
        try:
            seen = {r[0] for r in db.execute("SELECT id FROM sources")}
            seen |= {r[0] for r in db.execute("SELECT to_key FROM links WHERE type = 'source'")}
            seen |= {r[0] for r in db.execute("SELECT key FROM rejects")}
        finally:
            db.close()
        lines = read_lines(_path(home))
        seen |= {ig_key(u) for ln in lines if (u := parse_queue_line(ln))}
        new = [u for u in urls if ig_key(u) not in seen]
        if new:
            write_lines(home, _path(home), [*lines, *(f"- {u}" for u in new)])
    return len(new)


def next_queue(home: Path, n: int = 15) -> list[str]:
    """Take the next `n` links off the top of the queue."""
    with write_lock(home):
        lines = read_lines(_path(home))
        taken: list[str] = []
        kept: list[str] = []
        for ln in lines:
            u = parse_queue_line(ln) if len(taken) < n else None
            (taken.append(u) if u else kept.append(ln))
        if taken:
            write_lines(home, _path(home), kept)
    return taken


pop_queue = next_queue
import_ig_backlog = import_ig_export
