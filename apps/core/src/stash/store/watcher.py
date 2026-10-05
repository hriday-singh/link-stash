"""Filesystem watcher for STASH_HOME library and inventory changes."""

from collections.abc import AsyncIterator
from pathlib import Path
from typing import cast

import watchfiles

from stash.store.index import reindex_path, remove_path


def is_ignored(path: Path) -> bool:
    """Return True if path should be ignored (temp files, locks, index dir)."""
    name = path.name
    if ".tmp" in name or name.startswith(".lock"):
        return True
    return any(part.startswith(".index") for part in path.parts)


async def watch(home: Path) -> AsyncIterator[set[tuple[watchfiles.Change, Path]]]:
    """Watch library/ and inventory/ under STASH_HOME.

    Ignores *.tmp, .lock, and .index/. Reindexes each batch BEFORE yielding it.
    """
    home = Path(home)
    lib_dir = home / "library"
    inv_dir = home / "inventory"

    lib_dir.mkdir(parents=True, exist_ok=True)
    inv_dir.mkdir(parents=True, exist_ok=True)

    watch_dirs = [lib_dir, inv_dir]
    raw_generator = cast(
        AsyncIterator[set[tuple[watchfiles.Change, str]]],
        watchfiles.awatch(*watch_dirs),  # pyright: ignore[reportUnknownMemberType]
    )
    async for raw_changes in raw_generator:
        processed_changes: set[tuple[watchfiles.Change, Path]] = set()

        for change, raw_path_str in raw_changes:
            p = Path(raw_path_str)
            if is_ignored(p):
                continue

            # Process index update before yielding
            if change == watchfiles.Change.deleted:
                remove_path(home, p)
            else:
                reindex_path(home, p)

            processed_changes.add((change, p))

        if processed_changes:
            yield processed_changes
