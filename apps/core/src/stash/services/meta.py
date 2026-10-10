"""Metadata aggregation, category color assignment, and config persistence."""

import contextlib
from pathlib import Path

import tomlkit

from stash import __version__
from stash.config import Config
from stash.server.schemas import CategoryMeta, MetaCounts, MetaResponse, TagMeta
from stash.store.index import connect
from stash.store.lock import write_lock
from stash.store.models import SEED_CATEGORIES
from stash.store.queries import get_categories_with_counts, get_meta_counts, get_tags_with_counts

EXTRA_COLORS = [f"cat-extra-{i}" for i in range(1, 7)]


def get_category_colors(
    home: Path,
    config: Config,
    category_names: list[str],
) -> dict[str, str]:
    """Returns mapping of category name to css color token.

    Persists newly encountered categories to config.toml with tomlkit under write lock.
    """
    colors: dict[str, str] = {}

    # 1. Seed categories
    for cat in SEED_CATEGORIES:
        colors[cat] = f"cat-{cat}"

    # 2. Configured category colors
    for cat, color in config.category_colors.items():
        colors[cat] = color

    # 3. Discover unmapped categories and assign free cat-extra-N tokens
    used_tokens = set(colors.values())
    unmapped = [c for c in category_names if c not in colors]

    if not unmapped:
        return colors

    newly_assigned: dict[str, str] = {}
    for cat in unmapped:
        free_token = next((t for t in EXTRA_COLORS if t not in used_tokens), "cat-extra-6")
        colors[cat] = free_token
        used_tokens.add(free_token)
        newly_assigned[cat] = free_token

    # Persist newly assigned categories to config.toml
    config_path = home / "config.toml"
    with write_lock(home):
        doc = tomlkit.document()
        if config_path.is_file():
            with contextlib.suppress(Exception):
                doc = tomlkit.parse(config_path.read_text(encoding="utf-8"))

        if "category_colors" not in doc:
            doc["category_colors"] = tomlkit.table()

        tbl = doc["category_colors"]
        for cat, color in newly_assigned.items():
            tbl[cat] = color
            config.category_colors[cat] = color

        config_path.write_text(tomlkit.dumps(doc), encoding="utf-8")

    return colors


def get_meta(home: Path, config: Config) -> MetaResponse:
    """Collects metadata, tag frequencies, category colors, and counts."""
    conn = connect(home)
    try:
        counts_dict = get_meta_counts(conn)
        cat_rows = get_categories_with_counts(conn)
        cat_names = [r["category"] for r in cat_rows]

        color_map = get_category_colors(home, config, cat_names)

        categories = [
            CategoryMeta(
                name=r["category"],
                color=color_map.get(r["category"], "cat-practices"),
                count=r["count"],
            )
            for r in cat_rows
        ]

        tag_rows = get_tags_with_counts(conn)
        tags = [TagMeta(tag=r["tag"], count=r["count"]) for r in tag_rows]

        return MetaResponse(
            categories=categories,
            tags=tags,
            counts=MetaCounts(**counts_dict),
            version=__version__,
        )
    finally:
        conn.close()
