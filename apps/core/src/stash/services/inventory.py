"""Inventory: read-only scan of installed tools into inventory/auto/, and `have` into manual/."""

import re
import time
from datetime import UTC, datetime
from pathlib import Path

import yaml

from stash.errors import Invalid
from stash.scanners import SCANNERS, Scanner
from stash.store.index import connect, remove_path
from stash.store.keys import parse_ig_url
from stash.store.lists import inventory_line, parse_inventory_line, read_lines, write_lines
from stash.store.lock import write_lock
from stash.store.models import InventoryEntry

STALE_AFTER = 24 * 3600
MANUAL_FILE = {"ui_ref": "ui-ux", "practice": "practices", "model": "models"}  # else tools
_URL = re.compile(r"https?://\S+")
_KIND = re.compile(r"^\[(?P<kind>[\w-]+)\]\s*(?P<rest>.*)$", re.DOTALL)


def _log(home: Path, msg: str) -> None:
    logs = home / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    with open(logs / "scan.log", "a", encoding="utf-8") as f:
        f.write(f"{datetime.now(UTC).isoformat(timespec='seconds')} {msg}\n")


def is_fresh(home: Path) -> bool:
    files = list((home / "inventory" / "auto").glob("*.md"))
    return bool(files) and time.time() - max(f.stat().st_mtime for f in files) < STALE_AFTER


def is_inventory_stale(home: Path) -> bool:
    return not is_fresh(home)


def scan_inventory(
    home: Path,
    if_stale: bool = False,
    force: bool = False,
    user_home: Path | None = None,
    scanners: dict[str, Scanner] | None = None,
) -> dict[str, int] | None:
    """Run every scanner, write inventory/auto/<tool>.md, reindex. None when skipped as fresh.

    Returns item count per installed tool. A missing tool or failing scanner is logged to
    logs/scan.log and its stale auto file removed; it never fails the batch.
    """
    if if_stale and not force and is_fresh(home):
        return None
    user_home = user_home or Path.home()
    auto = home / "inventory" / "auto"
    counts: dict[str, int] = {}
    scanned_at = datetime.now(UTC).isoformat(timespec="seconds")
    with write_lock(home):
        for tool, scan in (scanners or SCANNERS).items():
            path = auto / f"{tool}.md"
            try:
                items = scan(user_home)
            except Exception as e:  # one broken tool config must not stop the scan
                _log(home, f"{tool}: scan failed: {type(e).__name__}: {e}")
                continue
            if items is None:
                _log(home, f"{tool}: not installed, skipped")
                if path.exists():
                    path.unlink()
                    remove_path(home, path)
                continue
            fm = yaml.safe_dump({"tool": tool, "scanned_at": scanned_at}, sort_keys=False)
            lines = [f"---\n{fm}---", *(inventory_line(k, n, key) for k, n, key in items)]
            write_lines(home, path, lines)
            counts[tool] = len(items)
    return counts


def key_for_url(url: str) -> tuple[str, str, str]:
    """(key, kind, display name) for a URL pasted into `have`."""
    from stash.extract.github import normalize_github_key, parse_github_url
    from stash.extract.hf import normalize_hf_key, parse_hf_url
    from stash.extract.notion import normalize_url_key

    try:
        owner, repo = parse_github_url(url)
        return normalize_github_key(owner, repo), "repo", f"{owner}/{repo}"
    except Invalid:
        pass
    try:
        hf_type, org, name = parse_hf_url(url)
        return normalize_hf_key(hf_type, org, name), "model", f"{org}/{name}"
    except Invalid:
        pass
    key = normalize_url_key(url)
    return key, "link", key.removeprefix("url:")


def _is_ig(url: str) -> bool:
    try:
        parse_ig_url(url)
        return True
    except Invalid:
        return False


def parse_have_text(text: str) -> tuple[str, str, str | None, str | None, str]:
    """Parse raw have text into (kind, name, key, note, file_stem)."""
    text = " ".join(text.split())
    kind: str | None = None
    if m := _KIND.match(text):
        kind, text = m["kind"], m["rest"]
    url_m = _URL.search(text)
    key = None
    name = text
    if url_m:
        url = url_m[0].rstrip(").,")
        if _is_ig(url):
            raise Invalid("an Instagram post is a source, not an inventory item", {"url": url})
        key, url_kind, url_name = key_for_url(url)
        kind = kind or url_kind
        name = (text[: url_m.start()] + text[url_m.end() :]).strip(" —-:") or url_name
    note = None
    for sep in (" — ", " -- ", " - ", ": "):
        if sep in name:
            name, _, note = name.partition(sep)
            name = name.strip()
            note = note.strip()
            break
    if not name:
        raise Invalid("nothing to add: give a name or a URL")
    kind = kind or "tool"
    file_stem = MANUAL_FILE.get(kind, "tools")
    return kind, name, key, note or None, file_stem


def have(home: Path, text: str) -> InventoryEntry:
    """Append `- [kind] name (key: k)` to inventory/manual/<file>.md. Idempotent on key.

    Text forms: `owner/repo URL`, `[tool] Scrapling — stealth scraping https://...`, plain words.
    """
    kind, name, key, note, file_stem = parse_have_text(text)
    origin = f"manual/{file_stem}.md"

    with write_lock(home):
        db = connect(home)
        try:
            if key:
                row = db.execute("SELECT * FROM inventory WHERE key = ?", (key,)).fetchone()
                if row:
                    return InventoryEntry(
                        key=row["key"], name=row["name"], kind=row["kind"], origin=row["origin"]
                    )
        finally:
            db.close()
        path = home / "inventory" / origin
        line = inventory_line(kind, name, key, note)
        write_lines(home, path, [*read_lines(path), line])
    entry = parse_inventory_line(line, origin)
    assert entry is not None
    return entry


def have_batch(home: Path, items: list[str]) -> list[InventoryEntry]:
    """Append multiple entries to inventory/manual under a single write lock."""
    parsed: list[tuple[str, str, str | None, str | None, str]] = []
    for raw in items:
        cleaned = raw.strip()
        if cleaned and not cleaned.startswith("#"):
            parsed.append(parse_have_text(cleaned))
    if not parsed:
        return []

    entries: list[InventoryEntry] = []
    by_file: dict[str, list[tuple[str, str, str | None, str | None]]] = {}
    for kind, name, key, note, file_stem in parsed:
        by_file.setdefault(file_stem, []).append((kind, name, key, note))

    with write_lock(home):
        db = connect(home)
        try:
            for file_stem, file_items in by_file.items():
                origin = f"manual/{file_stem}.md"
                path = home / "inventory" / origin
                current_lines = read_lines(path)
                new_lines: list[str] = []
                for kind, name, key, note in file_items:
                    if key:
                        row = db.execute("SELECT * FROM inventory WHERE key = ?", (key,)).fetchone()
                        if row:
                            entries.append(
                                InventoryEntry(
                                    key=row["key"],
                                    name=row["name"],
                                    kind=row["kind"],
                                    origin=row["origin"],
                                )
                            )
                            continue
                    line = inventory_line(kind, name, key, note)
                    new_lines.append(line)
                    ent = parse_inventory_line(line, origin)
                    if ent:
                        entries.append(ent)
                if new_lines:
                    write_lines(home, path, [*current_lines, *new_lines])
        finally:
            db.close()

    return entries

