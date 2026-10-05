"""Unit tests for rejects and pending services."""

from datetime import date
from pathlib import Path

import pytest

from stash.errors import Conflict, Invalid, NotFound
from stash.services.pending import add_pending, cta_pending, list_pending, new_id, resolve_pending
from stash.services.rejects import add_reject, list_rejects, remove_reject
from stash.store.index import connect
from stash.store.models import Mention, PendingItem, SourceDoc


def test_rejects_lifecycle(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    # Add reject
    entry = add_reject(home, "github:bad/tool", "Abandoned project")
    assert entry.key == "github:bad/tool"
    assert entry.reason == "Abandoned project"

    # Verify in list
    rejects = list_rejects(home)
    assert len(rejects) == 1
    assert rejects[0].key == "github:bad/tool"

    # Verify indexed in DB
    db = connect(home)
    row = db.execute("SELECT * FROM rejects WHERE key = ?", ("github:bad/tool",)).fetchone()
    assert row is not None
    assert row["reason"] == "Abandoned project"
    db.close()

    # Re-reject updates reason
    updated = add_reject(home, "github:bad/tool", "Archived repo")
    assert updated.reason == "Archived repo"
    rejects = list_rejects(home)
    assert len(rejects) == 1
    assert rejects[0].reason == "Archived repo"

    # Remove reject
    remove_reject(home, "github:bad/tool")
    assert len(list_rejects(home)) == 0

    # Removing again raises NotFound
    with pytest.raises(NotFound):
        remove_reject(home, "github:bad/tool")


def test_pending_lifecycle(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    item_id = new_id()
    item = PendingItem(
        id=item_id,
        kind="cta",
        source_key="ig:C12345",
        instruction="Comment PROMPT for link",
        status="open",
        added=date(2026, 10, 6),
    )
    add_pending(home, item)

    # Listing
    items = list_pending(home)
    assert len(items) == 1
    assert items[0].id == item_id
    assert items[0].status == "open"

    # Duplicate ID raises Conflict
    with pytest.raises(Conflict):
        add_pending(home, item)

    # Invalid characters in id/key
    with pytest.raises(Invalid):
        add_pending(home, item.model_copy(update={"id": "bad id with space"}))

    # Resolve
    resolved = resolve_pending(home, item_id, "https://github.com/cool/tool")
    assert resolved.status == "ready"
    assert resolved.url == "https://github.com/cool/tool"

    # Verify in list and DB
    items = list_pending(home)
    assert len(items) == 1
    assert items[0].status == "ready"
    assert items[0].url == "https://github.com/cool/tool"

    db = connect(home)
    row = db.execute("SELECT * FROM pending WHERE id = ?", (item_id,)).fetchone()
    assert row is not None
    assert row["status"] == "ready"
    assert row["url"] == "https://github.com/cool/tool"
    db.close()

    # Resolving nonexistent raises NotFound
    with pytest.raises(NotFound):
        resolve_pending(home, "p-missing", "https://example.com")


def test_cta_pending_filtering() -> None:
    # 1. Post with CTA keyword but NO mentions -> creates PendingItem
    doc_cta_only = SourceDoc(
        key="ig:C11111",
        platform="instagram",
        creator="techguru",
        url="https://www.instagram.com/reel/C11111/",
        stage="analyzed",
        cta={"keyword": "AI"},
        mentions=[],
    )
    pending = cta_pending(doc_cta_only)
    assert pending is not None
    assert pending.kind == "cta"
    assert pending.source_key == "ig:C11111"
    assert 'Comment "AI"' in pending.instruction

    # 2. Post with CTA keyword AND concrete mentions -> returns None (triaged normally)
    doc_with_mentions = SourceDoc(
        key="ig:C22222",
        platform="instagram",
        creator="techguru",
        url="https://www.instagram.com/reel/C22222/",
        stage="analyzed",
        cta={"keyword": "AI"},
        mentions=[Mention(kind="repo", name="cool-ai", url="https://github.com/org/cool-ai")],
    )
    assert cta_pending(doc_with_mentions) is None

    # 3. Post with no CTA keyword -> returns None
    doc_no_cta = SourceDoc(
        key="ig:C33333",
        platform="instagram",
        creator="techguru",
        url="https://www.instagram.com/reel/C33333/",
        stage="analyzed",
        cta=None,
        mentions=[],
    )
    assert cta_pending(doc_no_cta) is None
