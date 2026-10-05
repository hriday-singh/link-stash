"""Source document storage, reading, writing, and failure logging."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, cast

import yaml

from stash.errors import NotFound
from stash.store.cards import write_atomic
from stash.store.index import reindex_path
from stash.store.keys import source_dir
from stash.store.lock import write_lock
from stash.store.models import Mention, SourceDoc


def read_source(home: Path, key: str) -> SourceDoc:
    """Read a SourceDoc from library/sources/<id>/source.md.

    Raises NotFound if source.md does not exist.
    """
    home = Path(home)
    s_dir = source_dir(home, key)
    source_file = s_dir / "source.md"

    if not source_file.exists():
        raise NotFound(
            f"Source document not found for key: {key}", {"key": key, "path": str(source_file)}
        )

    text = source_file.read_text(encoding="utf-8")
    fm_raw = ""
    caption = ""

    if text.startswith("---\n"):
        parts = text[4:].split("\n---\n", 1)
        if len(parts) == 2:
            fm_raw, caption = parts
        elif text[4:].endswith("\n---"):
            fm_raw = text[4:-4]
    else:
        raise NotFound(f"Invalid source document format for key: {key}")

    raw_obj: object = yaml.safe_load(fm_raw)
    if not isinstance(raw_obj, dict):
        raise NotFound(f"Corrupted source frontmatter for key: {key}")

    data: dict[str, Any] = cast(dict[str, Any], raw_obj)

    # Ensure key and required fields
    data.setdefault("key", key)
    if "caption" not in data or not data["caption"]:
        data["caption"] = caption.strip() or None

    # Parse nested mentions
    if "mentions" in data and isinstance(data["mentions"], list):
        raw_mentions: list[Any] = cast(list[Any], data["mentions"])
        data["mentions"] = [
            Mention.model_validate(m) if isinstance(m, dict) else m for m in raw_mentions
        ]

    # Convert paths if present
    if data.get("video"):
        data["video"] = Path(str(data["video"]))
    if data.get("thumb"):
        data["thumb"] = Path(str(data["thumb"]))

    return SourceDoc.model_validate(data)


def write_source(home: Path, doc: SourceDoc) -> Path:
    """Write SourceDoc to library/sources/<id>/source.md under lock and reindex."""
    home = Path(home)
    with write_lock(home):
        s_dir = source_dir(home, doc.key)
        s_dir.mkdir(parents=True, exist_ok=True)
        source_file = s_dir / "source.md"

        data = doc.model_dump(exclude={"caption"})
        # Convert Path fields to relative POSIX strings
        if data.get("video") is not None:
            data["video"] = Path(data["video"]).as_posix()
        if data.get("thumb") is not None:
            data["thumb"] = Path(data["thumb"]).as_posix()
        if isinstance(data.get("fetched_at"), datetime):
            data["fetched_at"] = data["fetched_at"].isoformat()

        fm_yaml = yaml.safe_dump(data, sort_keys=False, allow_unicode=True)
        caption_text = doc.caption or ""
        content = f"---\n{fm_yaml}---\n{caption_text}\n"

        write_atomic(source_file, content)
        reindex_path(home, source_file)
        return source_file


def append_failed(home: Path, entry: dict[str, Any]) -> None:
    """Append a failure entry to logs/failed.jsonl."""
    home = Path(home)
    logs_dir = home / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    failed_file = logs_dir / "failed.jsonl"

    line = json.dumps(entry, ensure_ascii=False)
    with open(failed_file, "a", encoding="utf-8") as f:
        f.write(f"{line}\n")
