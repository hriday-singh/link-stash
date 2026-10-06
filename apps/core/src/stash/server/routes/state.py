"""FastAPI routes for pending, rejected, and inventory state management."""

import sqlite3
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends

from stash.errors import Invalid, NotFound
from stash.server.routes.cards import get_db, get_home
from stash.server.schemas import InventoryAddRequest, PendingResolveRequest
from stash.services.extract import extract
from stash.services.inventory import have
from stash.services.pending import drop_pending, list_pending, resolve_pending
from stash.services.rejects import remove_reject
from stash.store.models import InventoryEntry, PendingItem, RejectEntry

router = APIRouter(prefix="/api", tags=["state"])


@router.get("/pending", response_model=list[PendingItem])
def get_pending(home: Path = Depends(get_home)) -> list[PendingItem]:
    """Lists pending link requests from pending.md."""
    return list_pending(home)


@router.post("/pending/{id}/resolve", response_model=PendingItem)
def resolve_pending_item(
    id: str,
    body: PendingResolveRequest,
    home: Path = Depends(get_home),
) -> PendingItem:
    """Resolves a pending item by attaching the obtained destination URL."""
    clean_url = body.url.strip()
    if not (clean_url.startswith("http://") or clean_url.startswith("https://")):
        raise Invalid("URL must start with http:// or https://", {"url": clean_url})
    return resolve_pending(home, id, clean_url)


@router.delete("/pending/{id}")
def delete_pending_item(id: str, home: Path = Depends(get_home)) -> dict[str, str]:
    """Drops a pending item (no-op if already gone)."""
    drop_pending(home, id)
    return {"status": "removed", "id": id}


@router.post("/pending/{id}/recheck")
def recheck_pending_item(id: str, home: Path = Depends(get_home)) -> dict[str, Any]:
    """Re-runs the Instagram fetch for a blocked item; success drops it from pending."""
    item = next((p for p in list_pending(home) if p.id == id), None)
    if item is None or not item.source_key or not item.source_key.startswith("ig:"):
        raise NotFound(f"no recheckable pending item {id}", {"id": id})
    code = item.source_key.removeprefix("ig:")
    result = extract(home, [f"https://www.instagram.com/reel/{code}/"])[0]
    return {"id": id, "status": str(result.get("status", "failed")), "key": item.source_key}


@router.get("/rejects", response_model=list[RejectEntry])
def get_rejects(conn: sqlite3.Connection = Depends(get_db)) -> list[RejectEntry]:
    """Retrieves all rejected items."""
    rows = conn.execute(
        "SELECT key, date, reason FROM rejects ORDER BY date DESC, key ASC"
    ).fetchall()
    return [RejectEntry(key=r["key"], date=r["date"], reason=r["reason"]) for r in rows]


@router.delete("/rejects/{key:path}")
def delete_reject(
    key: str,
    home: Path = Depends(get_home),
) -> dict[str, str]:
    """Un-rejects an item, removing it from rejected.md."""
    remove_reject(home, key)
    return {"status": "removed", "key": key}


@router.get("/inventory", response_model=list[InventoryEntry])
def get_inventory(conn: sqlite3.Connection = Depends(get_db)) -> list[InventoryEntry]:
    """Lists all scanned and manual inventory items."""
    rows = conn.execute(
        "SELECT key, name, kind, origin FROM inventory ORDER BY name ASC"
    ).fetchall()
    return [
        InventoryEntry(key=r["key"], name=r["name"], kind=r["kind"], origin=r["origin"])
        for r in rows
    ]


@router.post("/inventory", response_model=InventoryEntry)
def add_inventory(
    body: InventoryAddRequest,
    home: Path = Depends(get_home),
) -> InventoryEntry:
    """Adds a new manual inventory entry to inventory/manual/tools.md."""
    return have(home, body.text)
