from datetime import date
from pathlib import Path
from typing import Any

import pytest
import watchfiles

from stash.server.events import EventHub, events_for_changes
from stash.store.cards import save_card
from stash.store.models import Card


def test_events_for_card_changed_and_deleted(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    # Save a card
    c = Card(
        schema=1,
        key="test:c1",
        title="Card One",
        category="models",
        kind="model",
        added=date(2026, 10, 6),
    )
    p1 = save_card(home, c, "Body of card one", slug="card-one")

    # 1. Modified existing card
    changes = {(watchfiles.Change.modified, p1)}
    evs = events_for_changes(home, changes)
    assert len(evs) == 1
    assert evs[0]["event"] == "card.changed"
    assert evs[0]["data"]["slug"] == "card-one"
    assert "hash" in evs[0]["data"]

    # 2. Deleted card (simulated file deletion and unindexed)
    p_deleted = home / "library" / "items" / "models" / "deleted-card.md"
    changes_del = {(watchfiles.Change.deleted, p_deleted)}
    evs_del = events_for_changes(home, changes_del)
    assert len(evs_del) == 1
    assert evs_del[0]["event"] == "card.deleted"
    assert evs_del[0]["data"]["slug"] == "deleted-card"


def test_category_move_in_one_batch_emits_one_card_changed(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    # Card currently in repos-tools
    c = Card(
        schema=1,
        key="test:move",
        title="Moving Tool",
        category="models",  # moved to models in DB
        kind="tool",
        added=date(2026, 10, 6),
    )
    new_path = save_card(home, c, "Body text", slug="moving-tool")
    old_path = home / "library" / "items" / "repos-tools" / "moving-tool.md"

    # Single batch has both deleted (old path) and added/modified (new path)
    changes = {
        (watchfiles.Change.deleted, old_path),
        (watchfiles.Change.added, new_path),
    }

    evs = events_for_changes(home, changes)
    # Must emit exactly one card.changed event, never card.deleted!
    assert len(evs) == 1
    assert evs[0]["event"] == "card.changed"
    assert evs[0]["data"]["slug"] == "moving-tool"


def test_source_and_state_events(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    changes = {
        (watchfiles.Change.modified, home / "library" / "sources" / "ig-123" / "source.md"),
        (watchfiles.Change.modified, home / "library" / "pending.md"),
        (watchfiles.Change.added, home / "inventory" / "auto" / "claude.md"),
    }

    evs = events_for_changes(home, changes)
    event_types = {e["event"] for e in evs}
    assert "source.changed" in event_types
    assert "state.changed" in event_types

    source_ev = next(e for e in evs if e["event"] == "source.changed")
    assert source_ev["data"]["id"] == "ig-123"

    state_evs = [e for e in evs if e["event"] == "state.changed"]
    files = {e["data"]["file"] for e in state_evs}
    assert "pending.md" in files
    assert "claude.md" in files


@pytest.mark.anyio
async def test_event_hub_broadcast_and_overflow() -> None:
    hub = EventHub(maxsize=3)
    q = hub.register_subscriber()

    # Broadcast 2 events
    await hub.broadcast({"event": "card.changed", "data": {"slug": "c1"}})
    await hub.broadcast({"event": "card.changed", "data": {"slug": "c2"}})

    assert q.qsize() == 2

    # Now overflow by broadcasting 5 more events
    for i in range(5):
        await hub.broadcast({"event": "card.changed", "data": {"slug": f"extra-{i}"}})

    # After overflow, queue was cleared and index.rebuilt pushed
    events: list[dict[str, Any]] = []
    while not q.empty():
        events.append(q.get_nowait())

    rebuilt_events = [e for e in events if e["event"] == "index.rebuilt"]
    assert len(rebuilt_events) >= 1
    hub.unregister_subscriber(q)
