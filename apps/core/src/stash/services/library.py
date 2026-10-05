"""Library service: reads and shapes data for the web API."""

import sqlite3
from pathlib import Path

from stash.errors import NotFound
from stash.server.schemas import (
    CardDetail,
    CardLinks,
    CardTile,
    GraphData,
    GraphEdge,
    GraphNode,
    Page,
    SearchHit,
    SourceDetail,
    SourceRow,
)
from stash.services.paging import decode_cursor, encode_cursor, fts_query
from stash.store.cards import content_hash, parse_card
from stash.store.notes import split_notes
from stash.store.queries import (
    get_card_links_rows,
    get_card_row_by_slug,
    get_cards_for_source,
    get_graph_elements,
    get_source_row_by_id,
    list_cards_rows,
    list_sources_rows,
    search_cards_rows,
)
from stash.store.sources import read_source


def get_cards_page(
    home: Path,
    conn: sqlite3.Connection,
    limit: int = 50,
    cursor: str | None = None,
    category: str | None = None,
    kind: str | None = None,
    tag: str | None = None,
    creator: str | None = None,
    since: str | None = None,
    until: str | None = None,
    has_video: bool | None = None,
) -> Page[CardTile]:
    """Retrieves a paginated list of card tiles with filters."""
    cursor_added: str | None = None
    cursor_slug: str | None = None
    if cursor:
        cur_data = decode_cursor(cursor)
        cursor_added = cur_data.get("added")
        cursor_slug = cur_data.get("slug")

    rows = list_cards_rows(
        conn=conn,
        limit=limit,
        cursor_added=cursor_added,
        cursor_slug=cursor_slug,
        category=category,
        kind=kind,
        tag=tag,
        creator=creator,
        since=since,
        until=until,
        has_video=has_video,
    )

    has_more = len(rows) > limit
    page_rows = rows[:limit] if has_more else rows

    items: list[CardTile] = []
    for r in page_rows:
        source_id = r["source_id"]
        thumb_path = r["thumb_path"]
        thumb_url = f"/api/sources/{source_id}/thumb" if (source_id and thumb_path) else None
        tag_list = r["tag_list"]
        tags = [t.strip() for t in tag_list.split(",") if t.strip()] if tag_list else []

        items.append(
            CardTile(
                key=r["key"],
                slug=r["slug"],
                title=r["title"],
                category=r["category"],
                kind=r["kind"],
                added=r["added"],
                url=r["url"],
                hash=r["hash"],
                thumb_url=thumb_url,
                platform=r["platform"],
                tags=tags,
            )
        )

    next_cursor: str | None = None
    if has_more and page_rows:
        last = page_rows[-1]
        next_cursor = encode_cursor({"added": last["added"], "slug": last["slug"]})

    return Page(items=items, next_cursor=next_cursor)


def get_card_detail(home: Path, conn: sqlite3.Connection, slug: str) -> CardDetail:
    """Reads card detail from SQLite index and source file on disk."""
    row = get_card_row_by_slug(conn, slug)
    if not row:
        raise NotFound(f"Card not found with slug: {slug}", {"slug": slug})

    card_path = home / row["path"]
    if not card_path.is_file():
        raise NotFound(
            f"Card file missing on disk: {row['path']}", {"slug": slug, "path": str(card_path)}
        )

    text = card_path.read_text(encoding="utf-8")
    card, raw_body = parse_card(text)
    file_hash = content_hash(text)
    body, notes = split_notes(raw_body)

    # Resolve links mapping for client hover/wikilink rendering
    backlinks, _, outgoing = get_card_links_rows(conn, row["key"])
    resolved: dict[str, str] = {}
    for r in backlinks:
        if r["slug"] and r["title"]:
            resolved[r["slug"]] = r["title"]
    for r in outgoing:
        if r["slug"] and r["title"]:
            resolved[r["slug"]] = r["title"]

    return CardDetail(
        slug=slug,
        card=card,
        body=body,
        notes=notes,
        hash=file_hash,
        resolved=resolved,
    )


def get_card_links(conn: sqlite3.Connection, slug: str) -> CardLinks:
    """Retrieves backlinks, mentioned_by, and outgoing links for a card."""
    row = get_card_row_by_slug(conn, slug)
    if not row:
        raise NotFound(f"Card not found with slug: {slug}", {"slug": slug})

    backlinks, mentioned_by, outgoing = get_card_links_rows(conn, row["key"])

    return CardLinks(
        backlinks=[
            {
                "slug": r["slug"],
                "title": r["title"],
                "category": r["category"],
                "kind": r["kind"],
                "type": r["type"],
            }
            for r in backlinks
        ],
        mentioned_by=[
            {
                "id": r["source_id"],
                "platform": r["platform"],
                "creator": r["creator"],
                "url": r["url"],
            }
            for r in mentioned_by
        ],
        outgoing=[
            {
                "target": r["to_key"],
                "type": r["type"],
                "slug": r["slug"] or "",
                "title": r["title"] or "",
                "category": r["category"] or "",
                "kind": r["kind"] or "",
            }
            for r in outgoing
        ],
    )


def get_sources_page(
    home: Path,
    conn: sqlite3.Connection,
    limit: int = 50,
    cursor: str | None = None,
    platform: str | None = None,
    creator: str | None = None,
    stage: str | None = None,
    has_video: bool | None = None,
) -> Page[SourceRow]:
    """Retrieves a paginated list of source rows."""
    cursor_id: str | None = None
    if cursor:
        cur_data = decode_cursor(cursor)
        cursor_id = cur_data.get("id")

    rows = list_sources_rows(
        conn=conn,
        limit=limit,
        cursor_id=cursor_id,
        platform=platform,
        creator=creator,
        stage=stage,
        has_video=has_video,
    )

    has_more = len(rows) > limit
    page_rows = rows[:limit] if has_more else rows

    items: list[SourceRow] = []
    for r in page_rows:
        has_v = bool(r["video"])
        has_t = bool(r["thumb"])
        items.append(
            SourceRow(
                id=r["id"],
                platform=r["platform"],
                creator=r["creator"],
                url=r["url"],
                stage=r["stage"],
                has_video=has_v,
                has_thumb=has_t,
                video_url=f"/api/sources/{r['id']}/video" if has_v else None,
                thumb_url=f"/api/sources/{r['id']}/thumb" if has_t else None,
                fetched_at=r["fetched_at"],
            )
        )

    next_cursor: str | None = None
    if has_more and page_rows:
        next_cursor = encode_cursor({"id": page_rows[-1]["id"]})

    return Page(items=items, next_cursor=next_cursor)


def get_source_detail(home: Path, conn: sqlite3.Connection, source_id: str) -> SourceDetail:
    """Reads source document and linked cards."""
    row = get_source_row_by_id(conn, source_id)
    if not row:
        raise NotFound(f"Source not found: {source_id}", {"source_id": source_id})

    source_doc = read_source(home, source_id)
    linked_cards = get_cards_for_source(conn, source_id)

    has_v = bool(row["video"])
    has_t = bool(row["thumb"])

    return SourceDetail(
        source=source_doc,
        video_url=f"/api/sources/{source_id}/video" if has_v else None,
        thumb_url=f"/api/sources/{source_id}/thumb" if has_t else None,
        cards=[
            {"slug": c["slug"], "title": c["title"], "category": c["category"], "kind": c["kind"]}
            for c in linked_cards
        ],
    )


def search_cards(conn: sqlite3.Connection, query: str, limit: int = 50) -> list[SearchHit]:
    """Runs safe FTS5 query with snippet highlighting."""
    formatted_q = fts_query(query)
    if not formatted_q:
        return []

    rows = search_cards_rows(conn, formatted_q, limit=limit)
    return [
        SearchHit(
            slug=r["slug"],
            title=r["title"],
            category=r["category"],
            kind=r["kind"],
            snippet=r["snippet"],
        )
        for r in rows
    ]


def get_graph(
    conn: sqlite3.Connection,
    center: str | None = None,
    depth: int = 1,
    category: str | None = None,
    edge_type: str | None = None,
) -> GraphData:
    """Constructs graph nodes and edges for visualization."""
    node_rows, edge_rows = get_graph_elements(
        conn=conn,
        center_slug=center,
        depth=depth,
        category=category,
        edge_type=edge_type,
    )

    nodes = [
        GraphNode(
            id=r["id"],
            label=r["label"],
            category=r["category"],
            kind=r["kind"],
        )
        for r in node_rows
    ]

    edges = [
        GraphEdge(
            source=r["source"],
            target=r["target"],
            type=r["type"],
        )
        for r in edge_rows
    ]

    return GraphData(nodes=nodes, edges=edges)
