"""Server-Sent Events hub and filesystem watcher change mapper."""

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import watchfiles

from stash.store.index import connect

logger = logging.getLogger("stash.server.events")


def events_for_changes(
    home: Path,
    changes: set[tuple[watchfiles.Change, Path]],
) -> list[dict[str, Any]]:
    """Translates raw filesystem change events into domain SSE events.

    Category move in one batch (delete old + create new) checks index state to emit
    a single card.changed event, never card.deleted.
    """
    card_slugs: set[str] = set()
    source_ids: set[str] = set()
    state_files: set[str] = set()

    for _, path in changes:
        try:
            rel = path.relative_to(home)
        except ValueError:
            continue

        parts = rel.parts
        if not parts:
            continue

        if (
            len(parts) >= 3
            and parts[0] == "library"
            and parts[1] == "items"
            and path.suffix == ".md"
        ):
            card_slugs.add(path.stem)
        elif len(parts) >= 3 and parts[0] == "library" and parts[1] == "sources":
            source_ids.add(parts[2])
        elif (
            len(parts) == 2
            and parts[0] == "library"
            and parts[1] in ("pending.md", "rejected.md", "queue.md")
        ):
            state_files.add(parts[1])
        elif len(parts) >= 1 and parts[0] in ("pending.md", "rejected.md", "queue.md"):
            state_files.add(parts[0])
        elif len(parts) >= 1 and parts[0] == "inventory":
            state_files.add(parts[-1])

    events: list[dict[str, Any]] = []

    # 1. Card events
    if card_slugs:
        conn = connect(home)
        try:
            for slug in sorted(card_slugs):
                row = conn.execute("SELECT hash FROM cards WHERE slug = ?", (slug,)).fetchone()
                if row:
                    events.append(
                        {"event": "card.changed", "data": {"slug": slug, "hash": row["hash"]}}
                    )
                else:
                    events.append({"event": "card.deleted", "data": {"slug": slug}})
        finally:
            conn.close()

    # 2. Source events
    for sid in sorted(source_ids):
        events.append({"event": "source.changed", "data": {"id": sid}})

    # 3. State events
    for sfile in sorted(state_files):
        events.append({"event": "state.changed", "data": {"file": sfile}})

    return events


class EventHub:
    """Manages active SSE client queues and event broadcasting."""

    def __init__(self, maxsize: int = 100) -> None:
        self._maxsize = maxsize
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def register_subscriber(self) -> asyncio.Queue[dict[str, Any]]:
        """Registers a new subscriber queue immediately and returns it."""
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=self._maxsize)
        self._subscribers.add(q)
        return q

    def unregister_subscriber(self, q: asyncio.Queue[dict[str, Any]]) -> None:
        """Removes a subscriber queue."""
        self._subscribers.discard(q)

    async def broadcast(self, event: dict[str, Any]) -> None:
        """Broadcasts an event to all subscribers.

        On queue overflow, purges subscriber queue and delivers index.rebuilt.
        """
        for q in list(self._subscribers):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                while not q.empty():
                    try:
                        q.get_nowait()
                    except asyncio.QueueEmpty:
                        break
                with contextlib.suppress(asyncio.QueueFull):
                    q.put_nowait({"event": "index.rebuilt", "data": {}})

    async def subscribe(self) -> AsyncIterator[dict[str, Any]]:
        """Yields an async stream of events for a connected SSE client."""
        q = self.register_subscriber()
        try:
            while True:
                event = await q.get()
                yield event
        finally:
            self.unregister_subscriber(q)


async def run_watcher_loop(home: Path, hub: EventHub) -> None:
    """Watches the filesystem and broadcasts mapped SSE events."""
    from stash.store.watcher import watch

    logger.info("Starting library watcher loop on: %s", home)
    try:
        async for batch in watch(home):
            events = events_for_changes(home, batch)
            for event in events:
                await hub.broadcast(event)
    except asyncio.CancelledError:
        logger.info("Watcher loop cancelled.")
        raise
    except Exception as e:
        logger.error("Watcher loop encountered unexpected error: %s", e)
