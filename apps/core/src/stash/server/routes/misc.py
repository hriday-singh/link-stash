"""FastAPI routes for metadata, search, graph visualization, reindexing, and SSE events."""

import asyncio
import json
import sqlite3
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import APIRouter, Depends, Query, Request
from starlette.responses import StreamingResponse

from stash.config import Config
from stash.server.events import EventHub
from stash.server.routes.cards import get_config, get_db, get_home
from stash.server.schemas import GraphData, MetaResponse, SearchHit
from stash.services.library import get_graph, search_cards
from stash.services.meta import get_meta
from stash.store.index import rebuild

router = APIRouter(prefix="/api", tags=["misc"])


def get_event_hub(request: Request) -> EventHub:
    return request.app.state.event_hub  # type: ignore[no-any-return]


@router.get("/meta", response_model=MetaResponse)
def get_metadata(
    home: Path = Depends(get_home),
    config: Config = Depends(get_config),
) -> MetaResponse:
    """Returns categories, tags, counts, and application version."""
    return get_meta(home, config)


@router.get("/graph", response_model=GraphData)
def get_graph_data(
    center: str | None = None,
    depth: int = Query(1, ge=1, le=5),
    category: str | None = None,
    edge_type: str | None = None,
    conn: sqlite3.Connection = Depends(get_db),
) -> GraphData:
    """Returns nodes and edges for global graph or centered neighborhood."""
    return get_graph(
        conn=conn,
        center=center,
        depth=depth,
        category=category,
        edge_type=edge_type,
    )


@router.get("/search", response_model=list[SearchHit])
def search(
    q: str = Query(..., min_length=1),
    limit: int = Query(50, ge=1, le=200),
    conn: sqlite3.Connection = Depends(get_db),
) -> list[SearchHit]:
    """Searches cards using SQLite FTS5 with custom highlight snippets."""
    return search_cards(conn, q, limit=limit)


@router.post("/reindex")
async def trigger_reindex(
    home: Path = Depends(get_home),
    hub: EventHub = Depends(get_event_hub),
) -> dict[str, str]:
    """Rebuilds the entire SQLite search index from markdown files."""
    await asyncio.to_thread(rebuild, home)
    await hub.broadcast({"event": "index.rebuilt", "data": {}})
    return {"status": "rebuilt"}


@router.get("/events")
async def sse_events(
    hub: EventHub = Depends(get_event_hub),
) -> StreamingResponse:
    """Subscribes to live Server-Sent Events from the library watcher."""

    async def event_generator() -> AsyncIterator[str]:
        # Initial connect handshake
        yield "event: connected\ndata: {}\n\n"
        subscriber = hub.subscribe()
        try:
            while True:
                try:
                    # Send keep-alive every 15 seconds if no events arrive
                    event = await asyncio.wait_for(subscriber.__anext__(), timeout=15.0)
                    yield f"event: {event['event']}\ndata: {json.dumps(event['data'])}\n\n"
                except TimeoutError:
                    yield ": keepalive\n\n"
        except asyncio.CancelledError, StopAsyncIteration:
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
