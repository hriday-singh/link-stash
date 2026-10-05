"""Database read queries for Link Stash library server."""

import sqlite3
from typing import Any


def list_cards_rows(
    conn: sqlite3.Connection,
    limit: int = 50,
    cursor_added: str | None = None,
    cursor_slug: str | None = None,
    category: str | None = None,
    kind: str | None = None,
    tag: str | None = None,
    creator: str | None = None,
    since: str | None = None,
    until: str | None = None,
    has_video: bool | None = None,
) -> list[sqlite3.Row]:
    """Queries cards ordered by added DESC, slug ASC with keyset cursor and filters."""
    conditions: list[str] = []
    params: dict[str, Any] = {"limit": limit + 1}

    if cursor_added is not None and cursor_slug is not None:
        conditions.append(
            "(c.added < :cursor_added OR (c.added = :cursor_added AND c.slug > :cursor_slug))"
        )
        params["cursor_added"] = cursor_added
        params["cursor_slug"] = cursor_slug

    if category:
        conditions.append("c.category = :category")
        params["category"] = category

    if kind:
        conditions.append("c.kind = :kind")
        params["kind"] = kind

    if since:
        conditions.append("c.added >= :since")
        params["since"] = since

    if until:
        conditions.append("c.added <= :until")
        params["until"] = until

    if tag:
        conditions.append("c.key IN (SELECT key FROM tags WHERE tag = :tag)")
        params["tag"] = tag

    if creator:
        conditions.append(
            "c.key IN ("
            "  SELECT l.from_key FROM links l JOIN sources s ON l.to_key = s.id "
            "  WHERE s.creator = :creator "
            "  UNION "
            "  SELECT l.to_key FROM links l JOIN sources s ON l.from_key = s.id "
            "  WHERE s.creator = :creator"
            ")"
        )
        params["creator"] = creator

    if has_video is not None:
        video_subquery = (
            "  SELECT l.from_key FROM links l JOIN sources s ON l.to_key = s.id "
            "  WHERE s.video IS NOT NULL "
            "  UNION "
            "  SELECT l.to_key FROM links l JOIN sources s ON l.from_key = s.id "
            "  WHERE s.video IS NOT NULL"
        )
        if has_video:
            conditions.append(f"c.key IN ({video_subquery})")
        else:
            conditions.append(f"c.key NOT IN ({video_subquery})")

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    link_join = (
        "(l.to_key = s.id AND l.from_key = c.key) OR (l.from_key = s.id AND l.to_key = c.key)"
    )
    sql = f"""
    SELECT
        c.key,
        c.slug,
        c.title,
        c.category,
        c.kind,
        c.added,
        c.url,
        c.hash,
        c.path,
        (SELECT s.platform FROM links l JOIN sources s ON {link_join} LIMIT 1) as platform,
        (SELECT s.thumb FROM links l JOIN sources s ON {link_join} LIMIT 1) as thumb_path,
        (SELECT s.id FROM links l JOIN sources s ON {link_join} LIMIT 1) as source_id,
        (SELECT group_concat(t.tag, ',') FROM tags t WHERE t.key = c.key) as tag_list
    FROM cards c
    {where_clause}
    ORDER BY c.added DESC, c.slug ASC
    LIMIT :limit
    """

    cursor = conn.execute(sql, params)
    return cursor.fetchall()


def get_card_row_by_slug(conn: sqlite3.Connection, slug: str) -> sqlite3.Row | None:
    """Retrieves a single card row by unique slug."""
    sql = """
    SELECT
        c.key,
        c.slug,
        c.title,
        c.category,
        c.kind,
        c.added,
        c.url,
        c.hash,
        c.path,
        c.frontmatter
    FROM cards c
    WHERE c.slug = ?
    """
    cursor = conn.execute(sql, (slug,))
    return cursor.fetchone()


def get_card_links_rows(
    conn: sqlite3.Connection, card_key: str
) -> tuple[list[sqlite3.Row], list[sqlite3.Row], list[sqlite3.Row]]:
    """Returns (backlinks, mentioned_by, outgoing) for a card key."""
    # 1. Backlinks: other cards linking to this card
    sql_backlinks = """
    SELECT l.from_key, l.type, c.slug, c.title, c.category, c.kind
    FROM links l
    JOIN cards c ON l.from_key = c.key
    WHERE l.to_key = ? AND l.type IN ('wikilink', 'overlap')
    """
    backlinks = conn.execute(sql_backlinks, (card_key,)).fetchall()

    # 2. Mentioned by: sources mentioning this card
    sql_mentioned = """
    SELECT s.id as source_id, l.type, s.platform, s.creator, s.url, s.stage
    FROM links l
    JOIN sources s ON (l.to_key = s.id AND l.from_key = ?) OR (l.from_key = s.id AND l.to_key = ?)
    WHERE l.type = 'source'
    """
    mentioned_by = conn.execute(sql_mentioned, (card_key, card_key)).fetchall()

    # 3. Outgoing: targets this card links to
    sql_outgoing = """
    SELECT l.to_key, l.type, c.slug, c.title, c.category, c.kind
    FROM links l
    LEFT JOIN cards c ON l.to_key = c.key
    WHERE l.from_key = ?
    """
    outgoing = conn.execute(sql_outgoing, (card_key,)).fetchall()

    return backlinks, mentioned_by, outgoing


def list_sources_rows(
    conn: sqlite3.Connection,
    limit: int = 50,
    cursor_id: str | None = None,
    platform: str | None = None,
    creator: str | None = None,
    stage: str | None = None,
    has_video: bool | None = None,
) -> list[sqlite3.Row]:
    """Queries sources ordered by id DESC with cursor and filters."""
    conditions: list[str] = []
    params: dict[str, Any] = {"limit": limit + 1}

    if cursor_id is not None:
        conditions.append("s.id < :cursor_id")
        params["cursor_id"] = cursor_id

    if platform:
        conditions.append("s.platform = :platform")
        params["platform"] = platform

    if creator:
        conditions.append("s.creator = :creator")
        params["creator"] = creator

    if stage:
        conditions.append("s.stage = :stage")
        params["stage"] = stage

    if has_video is not None:
        if has_video:
            conditions.append("s.video IS NOT NULL")
        else:
            conditions.append("s.video IS NULL")

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    sql = f"""
    SELECT
        s.id,
        s.platform,
        s.creator,
        s.url,
        s.stage,
        s.video,
        s.thumb,
        s.engine,
        s.fetched_at
    FROM sources s
    {where_clause}
    ORDER BY s.id DESC
    LIMIT :limit
    """
    return conn.execute(sql, params).fetchall()


def get_source_row_by_id(conn: sqlite3.Connection, source_id: str) -> sqlite3.Row | None:
    """Retrieves a single source row by key."""
    sql = "SELECT * FROM sources WHERE id = ?"
    return conn.execute(sql, (source_id,)).fetchone()


def get_cards_for_source(conn: sqlite3.Connection, source_id: str) -> list[sqlite3.Row]:
    """Retrieves all cards linked to a given source."""
    sql = """
    SELECT c.slug, c.title, c.category, c.kind
    FROM links l
    JOIN cards c ON (l.to_key = c.key AND l.from_key = ?) OR (l.from_key = c.key AND l.to_key = ?)
    WHERE l.type = 'source'
    """
    return conn.execute(sql, (source_id, source_id)).fetchall()


def search_cards_rows(conn: sqlite3.Connection, query: str, limit: int = 50) -> list[sqlite3.Row]:
    """Executes FTS5 search with custom \x02 / \x03 highlight markers."""
    sql = """
    SELECT
        c.slug,
        c.title,
        c.category,
        c.kind,
        snippet(search, 3, '\x02', '\x03', '...', 24) as snippet
    FROM search s
    JOIN cards c ON s.key = c.key
    WHERE search MATCH ?
    ORDER BY rank
    LIMIT ?
    """
    return conn.execute(sql, (query, limit)).fetchall()


def get_meta_counts(conn: sqlite3.Connection) -> dict[str, int]:
    """Retrieves total entity counts across tables."""
    cards_count = conn.execute("SELECT count(*) FROM cards").fetchone()[0]
    sources_count = conn.execute("SELECT count(*) FROM sources").fetchone()[0]
    pending_count = conn.execute("SELECT count(*) FROM pending WHERE status = 'open'").fetchone()[0]
    rejected_count = conn.execute("SELECT count(*) FROM rejects").fetchone()[0]
    inventory_count = conn.execute("SELECT count(*) FROM inventory").fetchone()[0]

    return {
        "cards": int(cards_count),
        "sources": int(sources_count),
        "pending": int(pending_count),
        "rejected": int(rejected_count),
        "inventory": int(inventory_count),
    }


def get_tags_with_counts(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """Retrieves all tags ordered by frequency."""
    sql = "SELECT tag, count(*) as count FROM tags GROUP BY tag ORDER BY count DESC, tag ASC"
    return conn.execute(sql).fetchall()


def get_categories_with_counts(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """Retrieves categories with their card counts."""
    sql = "SELECT category, count(*) as count FROM cards GROUP BY category ORDER BY count DESC"
    return conn.execute(sql).fetchall()


def get_graph_elements(
    conn: sqlite3.Connection,
    center_slug: str | None = None,
    depth: int = 1,
    category: str | None = None,
    edge_type: str | None = None,
) -> tuple[list[sqlite3.Row], list[sqlite3.Row]]:
    """Returns (node_rows, edge_rows) for global or neighborhood graph."""
    if not center_slug:
        # Global graph
        node_conds: list[str] = []
        node_params: list[Any] = []
        if category:
            node_conds.append("c.category = ?")
            node_params.append(category)

        where_nodes = f"WHERE {' AND '.join(node_conds)}" if node_conds else ""
        nodes_sql = (
            f"SELECT c.slug as id, c.title as label, c.category, c.kind FROM cards c {where_nodes}"
        )
        nodes = conn.execute(nodes_sql, node_params).fetchall()
        node_ids = {row["id"] for row in nodes}

        edge_conds = [
            "l.from_key IN (SELECT key FROM cards)",
            "l.to_key IN (SELECT key FROM cards)",
        ]
        edge_params: list[Any] = []
        if edge_type:
            edge_conds.append("l.type = ?")
            edge_params.append(edge_type)

        edges_sql = f"""
        SELECT c1.slug as source, c2.slug as target, l.type
        FROM links l
        JOIN cards c1 ON l.from_key = c1.key
        JOIN cards c2 ON l.to_key = c2.key
        WHERE {" AND ".join(edge_conds)}
        """
        raw_edges = conn.execute(edges_sql, edge_params).fetchall()
        # Filter edges where both endpoints are in nodes
        filtered_edges = [
            e for e in raw_edges if e["source"] in node_ids and e["target"] in node_ids
        ]
        return nodes, filtered_edges

    # Local graph BFS from center_slug
    center_card = conn.execute(
        "SELECT key, slug, title, category, kind FROM cards WHERE slug = ?", (center_slug,)
    ).fetchone()
    if not center_card:
        return [], []

    visited_keys = {center_card["key"]}
    current_frontier = {center_card["key"]}

    for _ in range(depth):
        if not current_frontier:
            break
        placeholders = ",".join("?" for _ in current_frontier)
        neighbors_sql = f"""
        SELECT DISTINCT to_key as k FROM links
        WHERE from_key IN ({placeholders}) AND to_key IN (SELECT key FROM cards)
        UNION
        SELECT DISTINCT from_key as k FROM links
        WHERE to_key IN ({placeholders}) AND from_key IN (SELECT key FROM cards)
        """
        params = list(current_frontier) + list(current_frontier)
        rows = conn.execute(neighbors_sql, params).fetchall()
        next_frontier = {row["k"] for row in rows} - visited_keys
        visited_keys.update(next_frontier)
        current_frontier = next_frontier

    keys_placeholders = ",".join("?" for _ in visited_keys)
    nodes_sql = (
        "SELECT slug as id, title as label, category, kind FROM cards "
        f"WHERE key IN ({keys_placeholders})"
    )
    nodes = conn.execute(nodes_sql, list(visited_keys)).fetchall()

    edges_sql = f"""
    SELECT c1.slug as source, c2.slug as target, l.type
    FROM links l
    JOIN cards c1 ON l.from_key = c1.key
    JOIN cards c2 ON l.to_key = c2.key
    WHERE l.from_key IN ({keys_placeholders}) AND l.to_key IN ({keys_placeholders})
    """
    edges = conn.execute(edges_sql, list(visited_keys) + list(visited_keys)).fetchall()
    return nodes, edges
