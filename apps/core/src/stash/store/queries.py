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
    bucket: str | None = None,
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

    if bucket:
        # ponytail: unindexed json_extract scan; add a bucket column if the library gets large.
        conditions.append("json_extract(c.frontmatter, '$.bucket') = :bucket")
        params["bucket"] = bucket

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
        (SELECT group_concat(t.tag, ',') FROM tags t WHERE t.key = c.key) as tag_list,
        json_extract(c.frontmatter, '$.bucket') as bucket
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

    if platform == "other":
        conditions.append("s.platform NOT IN ('instagram', 'github', 'huggingface')")
    elif platform:
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
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Returns (nodes, edges) for global or neighborhood graph.

    Includes cards, sources, and creators.
    """
    if not center_slug:
        # Global graph
        node_conds: list[str] = []
        node_params: list[Any] = []
        if category:
            node_conds.append("c.category = ?")
            node_params.append(category)

        where_nodes = f"WHERE {' AND '.join(node_conds)}" if node_conds else ""
        nodes_sql = (
            f"SELECT c.key, c.slug as id, c.title as label, c.category, c.kind "
            f"FROM cards c {where_nodes}"
        )
        card_rows = conn.execute(nodes_sql, node_params).fetchall()
        nodes_map: dict[str, dict[str, Any]] = {}
        key_to_slug: dict[str, str] = {}
        for r in card_rows:
            nodes_map[r["id"]] = {
                "id": r["id"],
                "label": r["label"],
                "category": r["category"],
                "kind": r["kind"],
            }
            key_to_slug[r["key"]] = r["id"]

        edges: list[dict[str, Any]] = []

        # Card-to-card edges (wikilink, overlap)
        if not edge_type or edge_type in ("wikilink", "overlap"):
            card_edge_conds = [
                "l.from_key IN (SELECT key FROM cards)",
                "l.to_key IN (SELECT key FROM cards)",
            ]
            card_edge_params: list[Any] = []
            if edge_type:
                card_edge_conds.append("l.type = ?")
                card_edge_params.append(edge_type)
            else:
                card_edge_conds.append("l.type IN ('wikilink', 'overlap')")

            card_edges_sql = f"""
            SELECT c1.slug as source, c2.slug as target, l.type
            FROM links l
            JOIN cards c1 ON l.from_key = c1.key
            JOIN cards c2 ON l.to_key = c2.key
            WHERE {" AND ".join(card_edge_conds)}
            """
            raw_card_edges = conn.execute(card_edges_sql, card_edge_params).fetchall()
            for e in raw_card_edges:
                if e["source"] in nodes_map and e["target"] in nodes_map:
                    edges.append({"source": e["source"], "target": e["target"], "type": e["type"]})

        # Card-to-source and source-to-creator edges
        if (not edge_type or edge_type == "source") and key_to_slug:
            placeholders = ",".join("?" for _ in key_to_slug)
            source_links_sql = f"""
            SELECT l.from_key, s.id, s.creator, s.platform
            FROM links l
            JOIN sources s ON l.to_key = s.id
            WHERE l.type = 'source' AND l.from_key IN ({placeholders})
            """
            src_rows = conn.execute(source_links_sql, list(key_to_slug.keys())).fetchall()
            for sr in src_rows:
                card_slug = key_to_slug.get(sr["from_key"])
                if not card_slug or card_slug not in nodes_map:
                    continue
                src_id = sr["id"]
                if src_id not in nodes_map:
                    nodes_map[src_id] = {
                        "id": src_id,
                        "label": f"@{sr['creator']}" if sr["creator"] else src_id,
                        "category": "source",
                        "kind": "source",
                    }
                edges.append({"source": card_slug, "target": src_id, "type": "source"})

                if sr["creator"]:
                    creator_id = f"creator:{sr['creator']}"
                    if creator_id not in nodes_map:
                        nodes_map[creator_id] = {
                            "id": creator_id,
                            "label": f"@{sr['creator']}",
                            "category": "creator",
                            "kind": "creator",
                        }
                    creator_edge = {"source": src_id, "target": creator_id, "type": "source"}
                    if creator_edge not in edges:
                        edges.append(creator_edge)

        return list(nodes_map.values()), edges

    # Local graph BFS from center_slug
    center_card = conn.execute(
        "SELECT key, slug, title, category, kind FROM cards WHERE slug = ?", (center_slug,)
    ).fetchone()
    if not center_card:
        return [], []

    visited_card_keys = {center_card["key"]}
    visited_source_ids: set[str] = set()
    current_card_keys = {center_card["key"]}

    for step in range(depth):
        if not current_card_keys:
            break
        placeholders = ",".join("?" for _ in current_card_keys)

        # 1. Neighbor cards via wikilinks and overlaps
        neighbor_cards_sql = f"""
        SELECT DISTINCT to_key as k FROM links
        WHERE from_key IN ({placeholders}) AND to_key IN (SELECT key FROM cards)
        UNION
        SELECT DISTINCT from_key as k FROM links
        WHERE to_key IN ({placeholders}) AND from_key IN (SELECT key FROM cards)
        """
        nc_params = list(current_card_keys) + list(current_card_keys)
        nc_rows = conn.execute(neighbor_cards_sql, nc_params).fetchall()
        next_card_keys = {r["k"] for r in nc_rows} - visited_card_keys

        # 2. Neighbor sources connected to current cards
        sources_sql = f"""
        SELECT DISTINCT to_key as sid FROM links
        WHERE from_key IN ({placeholders}) AND type = 'source'
        """
        s_rows = conn.execute(sources_sql, list(current_card_keys)).fetchall()
        new_source_ids = {r["sid"] for r in s_rows} - visited_source_ids
        visited_source_ids.update(new_source_ids)

        # 3. If depth allows another hop, find sibling cards connected to those sources
        if step < depth - 1 and new_source_ids:
            src_placeholders = ",".join("?" for _ in new_source_ids)
            sibling_sql = f"""
            SELECT DISTINCT from_key as k FROM links
            WHERE to_key IN ({src_placeholders})
              AND type = 'source'
              AND from_key IN (SELECT key FROM cards)
            """
            sib_rows = conn.execute(sibling_sql, list(new_source_ids)).fetchall()
            next_card_keys.update({r["k"] for r in sib_rows} - visited_card_keys)

        visited_card_keys.update(next_card_keys)
        current_card_keys = next_card_keys

    # Assemble local nodes
    nodes_map: dict[str, dict[str, Any]] = {}
    key_to_slug: dict[str, str] = {}

    card_placeholders = ",".join("?" for _ in visited_card_keys)
    card_sql = (
        f"SELECT key, slug as id, title as label, category, kind "
        f"FROM cards WHERE key IN ({card_placeholders})"
    )
    card_rows = conn.execute(card_sql, list(visited_card_keys)).fetchall()
    for r in card_rows:
        nodes_map[r["id"]] = {
            "id": r["id"],
            "label": r["label"],
            "category": r["category"],
            "kind": r["kind"],
        }
        key_to_slug[r["key"]] = r["id"]

    # Assemble local sources and creators
    if visited_source_ids:
        src_placeholders = ",".join("?" for _ in visited_source_ids)
        src_rows = conn.execute(
            f"SELECT id, creator, platform FROM sources WHERE id IN ({src_placeholders})",
            list(visited_source_ids),
        ).fetchall()
        for sr in src_rows:
            sid = sr["id"]
            nodes_map[sid] = {
                "id": sid,
                "label": f"@{sr['creator']}" if sr["creator"] else sid,
                "category": "source",
                "kind": "source",
            }
            if sr["creator"]:
                cid = f"creator:{sr['creator']}"
                if cid not in nodes_map:
                    nodes_map[cid] = {
                        "id": cid,
                        "label": f"@{sr['creator']}",
                        "category": "creator",
                        "kind": "creator",
                    }

    # Assemble local edges
    edges: list[dict[str, Any]] = []

    # Card-to-card edges
    if not edge_type or edge_type in ("wikilink", "overlap"):
        card_edges_sql = f"""
        SELECT c1.slug as source, c2.slug as target, l.type
        FROM links l
        JOIN cards c1 ON l.from_key = c1.key
        JOIN cards c2 ON l.to_key = c2.key
        WHERE l.from_key IN ({card_placeholders}) AND l.to_key IN ({card_placeholders})
        """
        for e in conn.execute(card_edges_sql, list(visited_card_keys) * 2).fetchall():
            if not edge_type or e["type"] == edge_type:
                edges.append({"source": e["source"], "target": e["target"], "type": e["type"]})

    # Card-to-source and source-to-creator edges
    if (not edge_type or edge_type == "source") and visited_source_ids and visited_card_keys:
        src_placeholders = ",".join("?" for _ in visited_source_ids)
        src_edges_sql = f"""
        SELECT l.from_key, l.to_key as sid, s.creator
        FROM links l
        JOIN sources s ON l.to_key = s.id
        WHERE l.from_key IN ({card_placeholders})
          AND l.to_key IN ({src_placeholders})
          AND l.type = 'source'
        """
        for se in conn.execute(
            src_edges_sql, list(visited_card_keys) + list(visited_source_ids)
        ).fetchall():
            c_slug = key_to_slug.get(se["from_key"])
            if c_slug:
                edges.append({"source": c_slug, "target": se["sid"], "type": "source"})
            if se["creator"]:
                cid = f"creator:{se['creator']}"
                ce = {"source": se["sid"], "target": cid, "type": "source"}
                if ce not in edges:
                    edges.append(ce)

    return list(nodes_map.values()), edges


def get_card_row_by_key(conn: sqlite3.Connection, key: str) -> sqlite3.Row | None:
    """Retrieves a single card row by key."""
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
    WHERE c.key = ?
    """
    return conn.execute(sql, (key,)).fetchone()


def get_card_tags(conn: sqlite3.Connection, key: str) -> list[str]:
    """Retrieves all tags for a given card key."""
    sql = "SELECT tag FROM tags WHERE key = ? ORDER BY tag ASC"
    rows = conn.execute(sql, (key,)).fetchall()
    return [str(r["tag"]) for r in rows]


def suggest_search_rows(
    conn: sqlite3.Connection,
    tokens: list[str],
    limit: int = 40,
) -> list[sqlite3.Row]:
    """Queries FTS5 search table across cards and inventory using token prefix matching."""
    if not tokens:
        return []

    fts_expr = " OR ".join(f'"{t}"*' for t in tokens)
    sql = """
    SELECT
        s.key,
        s.doc_type,
        s.title,
        s.body,
        snippet(search, 3, '\x02', '\x03', '...', 20) as snippet,
        bm25(search) as rank
    FROM search s
    WHERE search MATCH ?
    ORDER BY rank ASC
    LIMIT ?
    """
    try:
        return conn.execute(sql, (fts_expr, limit)).fetchall()
    except sqlite3.OperationalError:
        return []


def find_cards_by_tags(
    conn: sqlite3.Connection, tags: list[str], limit: int = 10
) -> list[sqlite3.Row]:
    """Find cards that have any of the given tags."""
    if not tags:
        return []
    placeholders = ",".join("?" for _ in tags)
    sql = f"""
    SELECT DISTINCT c.key, c.slug, c.title, c.category, c.kind, c.url, c.frontmatter
    FROM tags t
    JOIN cards c ON t.key = c.key
    WHERE t.tag IN ({placeholders})
    LIMIT ?
    """
    return conn.execute(sql, (*tags, limit)).fetchall()
