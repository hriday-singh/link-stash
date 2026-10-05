"""Instagram saved posts backlog export parser."""

import json
from pathlib import Path
from typing import cast

from stash.store.keys import ig_key


def parse_ig_export(file_path: Path) -> list[tuple[str, str]]:
    """Parse Instagram saved_posts.json (or saved_media.json) export into (key, url) pairs."""
    path = Path(file_path)
    if not path.is_file():
        return []

    try:
        data: object = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []

    items: list[tuple[str, str]] = []
    seen: set[str] = set()

    def process_url(url: str) -> None:
        try:
            key = ig_key(url)
            if key not in seen:
                seen.add(key)
                items.append((key, url))
        except Exception:
            pass

    entries: list[object] = []
    if isinstance(data, dict):
        d = cast(dict[str, object], data)
        for k in ("saved_saved_media", "saved_posts", "saved"):
            v = d.get(k)
            if isinstance(v, list):
                entries = cast(list[object], v)
                break
    elif isinstance(data, list):
        entries = cast(list[object], data)

    for entry in entries:
        if isinstance(entry, dict):
            e_dict = cast(dict[str, object], entry)
            s_map = e_dict.get("string_map_data")
            if isinstance(s_map, dict):
                for v in cast(dict[str, object], s_map).values():
                    if isinstance(v, dict):
                        href = cast(dict[str, object], v).get("href")
                        if isinstance(href, str):
                            process_url(href)

            for key in ("href", "url", "link"):
                u = e_dict.get(key)
                if isinstance(u, str):
                    process_url(u)
        elif isinstance(entry, str):
            process_url(entry)

    return items
