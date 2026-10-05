"""Cursor encoding/decoding and SQLite FTS query formatting."""

import base64
import json
import re
from typing import Any, cast

from stash.errors import Invalid

TOKEN_REGEX = re.compile(r"[A-Za-z0-9_\u0080-\uffff.-]+")


def encode_cursor(payload: dict[str, Any]) -> str:
    """Encodes a dictionary into a URL-safe base64 string."""
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii")


def decode_cursor(cursor: str) -> dict[str, Any]:
    """Decodes a URL-safe base64 string into a dictionary, raising Invalid on failure."""
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        obj = json.loads(raw)
        if not isinstance(obj, dict):
            raise ValueError("Cursor payload must be a JSON object")
        return cast(dict[str, Any], obj)
    except Exception as e:
        raise Invalid(f"Invalid cursor: {e}", {"cursor": cursor}) from e


def fts_query(text: str | None) -> str | None:
    """Formats raw search text into a safe SQLite FTS5 query with prefix matching.

    Quotes each token to avoid syntax errors with boolean operators or punctuation,
    and appends '*' to the final token for typeahead prefix matching.
    """
    if not text or not text.strip():
        return None

    tokens = TOKEN_REGEX.findall(text)
    if not tokens:
        return None

    quoted: list[str] = []
    for i, token in enumerate(tokens):
        # Escape any internal double quotes just in case
        clean_token = token.replace('"', '""')
        if i == len(tokens) - 1:
            quoted.append(f'"{clean_token}"*')
        else:
            quoted.append(f'"{clean_token}"')

    return " ".join(quoted)
