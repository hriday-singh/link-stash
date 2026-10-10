"""Suggestion service: match installed tools, saved library cards, and practices."""

import json
import re
from pathlib import Path

from pydantic import BaseModel, Field

from stash.services.decisions import liked_tags, read_decisions
from stash.store.index import connect
from stash.store.queries import (
    find_cards_by_tags,
    get_card_row_by_key,
    get_card_tags,
    suggest_search_rows,
)

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "at",
    "by",
    "can",
    "do",
    "for",
    "from",
    "how",
    "if",
    "in",
    "is",
    "it",
    "my",
    "need",
    "of",
    "on",
    "or",
    "see",
    "some",
    "that",
    "the",
    "this",
    "to",
    "use",
    "using",
    "want",
    "we",
    "what",
    "which",
    "with",
}

BOOST_BUCKETS = ("try-now", "upgrade")


def _parse_inv_search_body(body: str) -> tuple[str, str | None, str]:
    """Extract (kind, note, origin) from inventory search body."""
    origin = "unknown"
    if " origin:" in body:
        body_part, _, origin_part = body.rpartition(" origin:")
        origin = origin_part.strip()
    else:
        body_part = body

    kind = "tool"
    note = None
    if body_part.startswith("[") and "]" in body_part:
        kind_part, _, rest = body_part[1:].partition("]")
        kind = kind_part.strip()
        note = rest.strip() or None
    elif body_part.strip():
        note = body_part.strip()

    return kind, note, origin


class InstalledSuggestion(BaseModel):
    name: str
    kind: str
    origin: str
    note: str | None = None
    key: str | None = None


class CardSuggestion(BaseModel):
    title: str
    slug: str
    category: str
    kind: str
    tags: list[str] = Field(default_factory=list)
    url: str | None = None
    snippet: str | None = None
    bucket: str | None = None


class PracticeSuggestion(BaseModel):
    name: str
    slug: str | None = None
    key: str | None = None
    summary: str
    origin: str


class SuggestResult(BaseModel):
    query: str
    found: bool
    installed: list[InstalledSuggestion] = Field(default_factory=list[InstalledSuggestion])
    cards: list[CardSuggestion] = Field(default_factory=list[CardSuggestion])
    practices: list[PracticeSuggestion] = Field(default_factory=list[PracticeSuggestion])


def tokenize_query(query: str) -> list[str]:
    """Extract lowercase search tokens, filtering out punctuation and stop words."""
    raw = re.findall(r"\b[a-zA-Z0-9_\-]+\b", query.lower())
    tokens: list[str] = []
    for t in raw:
        clean = t.strip("-_")
        if clean and len(clean) >= 2 and clean not in STOP_WORDS and clean not in tokens:
            tokens.append(clean)
    return tokens


def _clean_snippet(snip: str | None) -> str | None:
    if not snip:
        return None
    return snip.replace("\x02", "").replace("\x03", "").strip()


def _bucket(frontmatter: str | None) -> str | None:
    bucket = json.loads(frontmatter or "{}").get("bucket")
    return str(bucket) if bucket else None


def boost_cards(cards: list[CardSuggestion], liked: set[str]) -> list[CardSuggestion]:
    """Nudge cards up by at most two places: actionable bucket, then a liked tag.

    Relevance order stays primary; this only breaks near-ties toward the user's taste.
    """

    def score(pair: tuple[int, CardSuggestion]) -> int:
        i, c = pair
        return i - (c.bucket in BOOST_BUCKETS) - bool(liked & set(c.tags))

    return [c for _, c in sorted(enumerate(cards), key=score)]


def suggest_items(
    home: Path,
    query: str,
    category: str | None = None,
    kind: str | None = None,
    limit: int = 5,
) -> SuggestResult:
    """Consult stash for relevant tools, library cards, and practices for a given query."""
    tokens = tokenize_query(query)
    if not tokens:
        return SuggestResult(query=query, found=False)

    con = connect(home)
    try:
        search_rows = suggest_search_rows(con, tokens, limit=50)
        tag_card_rows = find_cards_by_tags(con, tokens, limit=10)

        installed: list[InstalledSuggestion] = []
        cards: list[CardSuggestion] = []
        practices: list[PracticeSuggestion] = []

        seen_inv: set[tuple[str, str]] = set()
        seen_cards: set[str] = set()
        seen_practices: set[str] = set()

        for r in search_rows:
            doc_type = str(r["doc_type"])
            key = str(r["key"])
            title = str(r["title"] or "")
            body = str(r["body"] or "")
            snip = _clean_snippet(r["snippet"])

            if doc_type == "inventory":
                i_kind, i_note, i_origin = _parse_inv_search_body(body)

                if kind and i_kind != kind:
                    continue

                if i_origin == "manual/practices.md":
                    if title.lower() not in seen_practices:
                        seen_practices.add(title.lower())
                        practices.append(
                            PracticeSuggestion(
                                name=title,
                                key=key if not key.startswith("inv:") else None,
                                summary=i_note or title,
                                origin=i_origin,
                            )
                        )
                else:
                    token = (title.lower(), i_origin)
                    if token not in seen_inv:
                        seen_inv.add(token)
                        installed.append(
                            InstalledSuggestion(
                                name=title,
                                kind=i_kind,
                                origin=i_origin,
                                note=i_note,
                                key=key if not key.startswith("inv:") else None,
                            )
                        )

            elif doc_type == "card":
                card_row = get_card_row_by_key(con, key)
                if not card_row:
                    continue
                c_slug = str(card_row["slug"])
                c_cat = str(card_row["category"])
                c_kind = str(card_row["kind"])
                c_url = str(card_row["url"]) if card_row["url"] else None

                if category and c_cat != category:
                    continue
                if kind and c_kind != kind:
                    continue

                c_tags = get_card_tags(con, key)

                if c_cat == "practices":
                    if c_slug not in seen_practices:
                        seen_practices.add(c_slug)
                        practices.append(
                            PracticeSuggestion(
                                name=str(card_row["title"]),
                                slug=c_slug,
                                key=key,
                                summary=snip or str(card_row["title"]),
                                origin=f"library/items/practices/{c_slug}.md",
                            )
                        )
                else:
                    if c_slug not in seen_cards:
                        seen_cards.add(c_slug)
                        cards.append(
                            CardSuggestion(
                                title=str(card_row["title"]),
                                slug=c_slug,
                                category=c_cat,
                                kind=c_kind,
                                tags=c_tags,
                                url=c_url,
                                snippet=snip,
                                bucket=_bucket(card_row["frontmatter"]),
                            )
                        )

        # Merge cards matched by tags
        for cr in tag_card_rows:
            c_key = str(cr["key"])
            c_slug = str(cr["slug"])
            c_cat = str(cr["category"])
            c_kind = str(cr["kind"])
            c_url = str(cr["url"]) if cr["url"] else None

            if category and c_cat != category:
                continue
            if kind and c_kind != kind:
                continue

            c_tags = get_card_tags(con, c_key)
            if c_cat == "practices":
                if c_slug not in seen_practices:
                    seen_practices.add(c_slug)
                    practices.append(
                        PracticeSuggestion(
                            name=str(cr["title"]),
                            slug=c_slug,
                            key=c_key,
                            summary=str(cr["title"]),
                            origin=f"library/items/practices/{c_slug}.md",
                        )
                    )
            else:
                if c_slug not in seen_cards:
                    seen_cards.add(c_slug)
                    cards.append(
                        CardSuggestion(
                            title=str(cr["title"]),
                            slug=c_slug,
                            category=c_cat,
                            kind=c_kind,
                            tags=c_tags,
                            url=c_url,
                            snippet=None,
                            bucket=_bucket(cr["frontmatter"]),
                        )
                    )

        inst_res = installed[:limit]
        cards_res = boost_cards(cards, set(liked_tags(read_decisions(home))))[:limit]
        prac_res = practices[:limit]
        found = bool(inst_res or cards_res or prac_res)

        return SuggestResult(
            query=query,
            found=found,
            installed=inst_res,
            cards=cards_res,
            practices=prac_res,
        )
    finally:
        con.close()
