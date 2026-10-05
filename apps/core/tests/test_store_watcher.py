"""Tests for the filesystem watcher in stash.store.watcher."""

from collections.abc import AsyncGenerator
from pathlib import Path
from unittest.mock import patch

import pytest
import watchfiles

from stash.store.watcher import is_ignored, watch


def test_is_ignored() -> None:
    assert is_ignored(Path("library/items/tools/card.md.tmp.1234"))
    assert is_ignored(Path(".lock"))
    assert is_ignored(Path("/path/to/.index/stash.db"))
    assert not is_ignored(Path("library/items/tools/card.md"))
    assert not is_ignored(Path("library/sources/ig-123/source.md"))


@pytest.mark.anyio
async def test_watch_yields_processed_changes(tmp_path: Path) -> None:
    card_path = tmp_path / "library" / "items" / "tools" / "sample.md"
    tmp_file = tmp_path / "library" / "items" / "tools" / "sample.md.tmp.1"
    deleted_path = tmp_path / "library" / "items" / "tools" / "old.md"

    fake_raw_changes: list[set[tuple[watchfiles.Change, str]]] = [
        {
            (watchfiles.Change.added, str(card_path)),
            (watchfiles.Change.modified, str(tmp_file)),  # should be ignored
            (watchfiles.Change.deleted, str(deleted_path)),
        }
    ]

    async def fake_awatch(*_dirs: Path) -> AsyncGenerator[set[tuple[watchfiles.Change, str]]]:
        for batch in fake_raw_changes:
            yield batch

    with (
        patch("watchfiles.awatch", side_effect=fake_awatch),
        patch("stash.store.watcher.reindex_path") as mock_reindex,
        patch("stash.store.watcher.remove_path") as mock_remove,
    ):
        batches: list[set[tuple[watchfiles.Change, Path]]] = []
        async for batch in watch(tmp_path):
            batches.append(batch)
            break

        assert len(batches) == 1
        changes = batches[0]
        # Only non-ignored paths yielded
        assert (watchfiles.Change.added, card_path) in changes
        assert (watchfiles.Change.deleted, deleted_path) in changes
        assert not any(p == tmp_file for _, p in changes)

        # Pre-yield hooks executed
        mock_reindex.assert_called_once_with(tmp_path, card_path)
        mock_remove.assert_called_once_with(tmp_path, deleted_path)
