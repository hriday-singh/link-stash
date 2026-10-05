"""FastAPI routes for card reading, editing, links, and deletion."""

import sqlite3
from collections.abc import Generator
from pathlib import Path

from fastapi import APIRouter, Depends, Query, Request

from stash.config import Config
from stash.server.schemas import CardDetail, CardLinks, CardPatch, CardRejectRequest, CardTile, Page
from stash.services.card_edit import reject_card, update_card
from stash.services.library import get_card_detail, get_card_links, get_cards_page
from stash.store.index import connect
from stash.store.models import Kind, RejectEntry

router = APIRouter(prefix="/api/cards", tags=["cards"])


def get_home(request: Request) -> Path:
    return request.app.state.config.home  # type: ignore[no-any-return]


def get_config(request: Request) -> Config:
    return request.app.state.config  # type: ignore[no-any-return]


def get_db(request: Request) -> Generator[sqlite3.Connection]:
    conn = connect(request.app.state.config.home)
    try:
        yield conn
    finally:
        conn.close()


@router.get("", response_model=Page[CardTile])
def list_cards(
    limit: int = Query(50, ge=1, le=200),
    cursor: str | None = None,
    category: str | None = None,
    kind: Kind | None = None,
    tag: str | None = None,
    creator: str | None = None,
    since: str | None = None,
    until: str | None = None,
    has_video: bool | None = None,
    home: Path = Depends(get_home),
    conn: sqlite3.Connection = Depends(get_db),
) -> Page[CardTile]:
    """Lists card tiles with optional filters and keyset cursor."""
    return get_cards_page(
        home=home,
        conn=conn,
        limit=limit,
        cursor=cursor,
        category=category,
        kind=kind,
        tag=tag,
        creator=creator,
        since=since,
        until=until,
        has_video=has_video,
    )


@router.get("/{slug}", response_model=CardDetail)
def get_card(
    slug: str,
    home: Path = Depends(get_home),
    conn: sqlite3.Connection = Depends(get_db),
) -> CardDetail:
    """Retrieves full card details including markdown body without notes, and notes section."""
    return get_card_detail(home, conn, slug)


@router.put("/{slug}", response_model=CardDetail)
def edit_card(
    slug: str,
    patch: CardPatch,
    home: Path = Depends(get_home),
    config: Config = Depends(get_config),
) -> CardDetail:
    """Updates editable frontmatter and Notes under write lock, guarding with base_hash."""
    return update_card(home, slug, patch, config)


@router.delete("/{slug}", response_model=RejectEntry)
def delete_card(
    slug: str,
    body: CardRejectRequest,
    home: Path = Depends(get_home),
) -> RejectEntry:
    """Rejects a card, removing it from library and logging to rejected.md."""
    return reject_card(home, slug, body.reason)


@router.get("/{slug}/links", response_model=CardLinks)
def get_links(
    slug: str,
    conn: sqlite3.Connection = Depends(get_db),
) -> CardLinks:
    """Retrieves backlinks, mentioned_by, and outgoing links for a card."""
    return get_card_links(conn, slug)
