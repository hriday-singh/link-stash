"""Services for editing and rejecting cards under lock."""

from pathlib import Path

from stash.config import Config, load_config
from stash.errors import Conflict, Invalid, NotFound
from stash.server.schemas import CardDetail, CardPatch
from stash.services.library import get_card_detail
from stash.services.rejects import add_reject
from stash.store.cards import card_path, content_hash, parse_card, render_card, write_atomic
from stash.store.index import connect, reindex_path, remove_path
from stash.store.lock import write_lock
from stash.store.models import SEED_CATEGORIES, RejectEntry
from stash.store.notes import replace_notes
from stash.store.queries import get_card_row_by_slug


def update_card(
    home: Path,
    slug: str,
    patch: CardPatch,
    config: Config | None = None,
) -> CardDetail:
    """Updates editable fields (notes, category, kind, tags) under the write lock.

    Guards against concurrent edits with base_hash check, raising Conflict (409) on mismatch.
    """
    cfg = config or load_config(home)

    with write_lock(home):
        conn = connect(home)
        try:
            row = get_card_row_by_slug(conn, slug)
            if not row:
                raise NotFound(f"Card not found: {slug}", {"slug": slug})

            old_path = home / row["path"]
            if not old_path.is_file():
                raise NotFound(f"Card file missing on disk: {row['path']}", {"slug": slug})

            text = old_path.read_text(encoding="utf-8")
            current_hash = content_hash(text)

            if current_hash != patch.base_hash:
                raise Conflict(
                    f"Hash mismatch: current {current_hash} != base {patch.base_hash}",
                    {"current_hash": current_hash, "base_hash": patch.base_hash},
                )

            card, body = parse_card(text)

            # Update category
            if patch.category is not None:
                new_cat = patch.category.strip()
                known_cats = set(SEED_CATEGORIES) | set(cfg.category_colors.keys())
                if new_cat not in known_cats:
                    raise Invalid(
                        f"Unknown category '{new_cat}'. Must be one of: {sorted(known_cats)}",
                        {"category": new_cat},
                    )
                card.category = new_cat

            # Update kind
            if patch.kind is not None:
                card.kind = patch.kind

            # Update tags
            if patch.tags is not None:
                card.tags = list(dict.fromkeys(t.strip().lower() for t in patch.tags if t.strip()))

            # Update notes section
            if patch.notes is not None:
                body = replace_notes(body, patch.notes)

            new_text = render_card(card, body)
            new_path = card_path(home, card.category, slug)

            if new_path != old_path:
                write_atomic(new_path, new_text)
                old_path.unlink(missing_ok=True)
                remove_path(home, old_path)
                reindex_path(home, new_path)
            else:
                write_atomic(new_path, new_text)
                reindex_path(home, new_path)

            return get_card_detail(home, conn, slug)
        finally:
            conn.close()


def reject_card(home: Path, slug: str, reason: str) -> RejectEntry:
    """Rejects a card, adding to rejected.md, removing file and clearing index."""
    clean_reason = reason.strip()
    if not clean_reason:
        raise Invalid("Rejection reason is required", {"slug": slug})

    with write_lock(home):
        conn = connect(home)
        try:
            row = get_card_row_by_slug(conn, slug)
            if not row:
                raise NotFound(f"Card not found: {slug}", {"slug": slug})

            key = row["key"]
            file_path = home / row["path"]

            entry = add_reject(home, key, clean_reason)
            file_path.unlink(missing_ok=True)
            remove_path(home, file_path)

            return entry
        finally:
            conn.close()
