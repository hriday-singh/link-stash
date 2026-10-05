"""Card serialization, parsing, hashing, and atomic filesystem operations."""

import hashlib
import os
import re
import uuid
from pathlib import Path
from typing import Any

import yaml
from pydantic import ValidationError

from stash.errors import Invalid
from stash.store.models import Card

ORDERED_KEYS = [
    "schema",
    "key",
    "title",
    "category",
    "kind",
    "tags",
    "added",
    "url",
    "sources",
    "facts",
    "features",
    "overlaps",
]


_SAFE_PART = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def card_path(home: Path, category: str, slug: str) -> Path:
    """Return the absolute path for a card file given its category and slug."""
    return home / "library" / "items" / category / f"{slug}.md"


def slugify(text: str) -> str:
    """Generate a clean URL/filename slug from text."""
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return slug or "untitled"


def parse_card(text: str) -> tuple[Card, str]:
    """Parse raw card markdown into a Card model and body text."""
    normalized = text.replace("\r\n", "\n")
    if not normalized.startswith("---\n"):
        raise Invalid("Card markdown must start with '---' frontmatter delimiter")

    rest = normalized[4:]
    delimiter = "\n---\n"
    if delimiter not in rest:
        # Check if closing delimiter is at end of string without trailing newline
        if rest.endswith("\n---"):
            fm_raw = rest[:-4]
            body = ""
        else:
            raise Invalid("Card markdown missing closing '---' frontmatter delimiter")
    else:
        fm_raw, body = rest.split(delimiter, 1)

    try:
        data = yaml.safe_load(fm_raw)
    except Exception as e:
        raise Invalid(f"Invalid YAML in card frontmatter: {e}") from e

    if not isinstance(data, dict):
        raise Invalid("Card frontmatter must be a YAML mapping")

    try:
        card = Card.model_validate(data)
    except ValidationError as e:
        raise Invalid(f"Invalid card frontmatter schema: {e}") from e

    return card, body


def render_card(card: Card, body: str) -> str:
    """Render a Card model and body text into canonical byte-stable markdown."""
    raw = card.model_dump(by_alias=True)
    ordered_data: dict[str, Any] = {}

    for key in ORDERED_KEYS:
        if key in raw:
            ordered_data[key] = raw[key]

    for key, val in raw.items():
        if key not in ordered_data:
            ordered_data[key] = val

    fm_text = yaml.safe_dump(ordered_data, sort_keys=False, allow_unicode=True)
    clean_body = body.replace("\r\n", "\n")

    return f"---\n{fm_text}---\n{clean_body}"


def content_hash(text: str) -> str:
    """Calculate the SHA-256 content hash of normalized card text."""
    normalized = text.replace("\r\n", "\n")
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def write_atomic(path: Path, text: str) -> None:
    """Atomically write text with normalized line endings to destination path."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(f"{path.suffix}.tmp.{os.getpid()}.{uuid.uuid4().hex[:8]}")
    normalized = text.replace("\r\n", "\n")

    try:
        with open(temp_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(normalized)
        temp_path.replace(path)
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise


def save_card(home: Path, card: Card, body: str, slug: str | None = None) -> Path:
    """Acquire write lock, resolve unique slug, write card atomically, and reindex."""
    from stash.store.index import connect, reindex_path
    from stash.store.lock import write_lock

    home = Path(home)
    # category and slug become path parts: no traversal, no odd characters
    for part in (card.category, slug):
        if part is not None and not _SAFE_PART.match(part):
            raise Invalid(
                "category and slug must be lowercase letters, digits and '-'", {"value": part}
            )
    with write_lock(home):
        db = connect(home)
        try:
            base_slug = slug or slugify(card.title)
            candidate_slug = base_slug
            counter = 2

            while True:
                row = db.execute(
                    "SELECT key, path FROM cards WHERE slug = ?",
                    (candidate_slug,),
                ).fetchone()

                if row is None:
                    candidate_path = card_path(home, card.category, candidate_slug)
                    if not candidate_path.exists():
                        break
                    try:
                        existing_card, _ = parse_card(candidate_path.read_text(encoding="utf-8"))
                        if existing_card.key == card.key:
                            break
                    except Exception:
                        pass
                else:
                    if row["key"] == card.key:
                        break

                candidate_slug = f"{base_slug}-{counter}"
                counter += 1

            dest_path = card_path(home, card.category, candidate_slug)
            content = render_card(card, body)
            write_atomic(dest_path, content)
            reindex_path(home, dest_path, con=db)
            return dest_path
        finally:
            db.close()
