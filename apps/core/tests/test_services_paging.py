import pytest

from stash.errors import Invalid
from stash.services.paging import decode_cursor, encode_cursor, fts_query


def test_cursor_round_trip() -> None:
    data = {"added": "2026-10-06", "slug": "fastapi-tool"}
    cursor = encode_cursor(data)
    assert isinstance(cursor, str)
    decoded = decode_cursor(cursor)
    assert decoded == data


def test_decode_invalid_cursor() -> None:
    with pytest.raises(Invalid) as exc_info:
        decode_cursor("not-base64!@#$")
    assert "Invalid cursor" in str(exc_info.value)

    # Base64 but not valid JSON
    with pytest.raises(Invalid):
        decode_cursor("dGVzdA==")  # "test"

    # Valid JSON but not a dictionary
    with pytest.raises(Invalid):
        decode_cursor("WzEsIDIsIDNd")  # "[1, 2, 3]"


def test_fts_query_empty() -> None:
    assert fts_query(None) is None
    assert fts_query("") is None
    assert fts_query("   ") is None


def test_fts_query_clean_tokens() -> None:
    assert fts_query("python") == '"python"*'
    assert fts_query("python code") == '"python" "code"*'


def test_fts_query_handles_special_operators_and_quotes() -> None:
    # Special operators like AND, OR, NOT, brackets, asterisks, double quotes
    raw = 'python AND (FastAPI OR "web-app")*'
    res = fts_query(raw)
    assert res is not None
    assert '"python"' in res
    assert '"FastAPI"' in res
    assert '"web-app"' in res
    assert res.endswith('*')
