from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

import pytest

from stash.errors import Blocked
from stash.extract.instagram import detect_cta, parse_embed, url_expiry

FIX = Path(__file__).parent / "fixtures" / "instagram"


def _parse(code: str, kind: Literal["reel", "p"]):
    return parse_embed((FIX / f"{code}.html").read_text(encoding="utf-8"), kind, code)


def test_reel() -> None:
    r = _parse("DeCczhMTU9A", "reel")
    assert r.key == "ig:DeCczhMTU9A"
    assert r.url == "https://www.instagram.com/reel/DeCczhMTU9A/"
    assert r.author == "thevarunmayya"
    assert r.comment_count == 114
    assert "ASD-STE100" in r.caption
    assert [m.type for m in r.media] == ["video"]
    assert r.media[0].poster and r.poster
    assert r.expires_at and r.expires_at.year == 2026
    assert r.cta_keyword is None


def test_reel_with_bare_caps_cta() -> None:
    assert _parse("DdjtsVnEVEU", "reel").cta_keyword == "JEV"


def test_mixed_carousel_keeps_order_and_types() -> None:
    r = _parse("Ddy6SMxjlpe", "p")
    assert [m.type for m in r.media] == ["image"] + ["video"] * 7 + ["image"]
    assert r.cta_keyword == "THRONE"


def test_image_carousel() -> None:
    r = _parse("Dd_1m-8iKAF", "p")
    assert len(r.media) == 8 and all(m.type == "image" for m in r.media)
    assert r.cta_keyword == "build"


def test_unavailable_post_is_blocked() -> None:
    with pytest.raises(Blocked) as e:
        _parse("DeB1kXbjWTe", "p")
    assert e.value.details["reason"] == "unavailable"


def test_login_wall_or_changed_page_is_blocked() -> None:
    with pytest.raises(Blocked) as e:
        parse_embed("<html><body>Log in</body></html>", "reel", "X")
    assert e.value.details["reason"] == "no_data"


@pytest.mark.parametrize(
    ("caption", "keyword"),
    [
        ("Comment “SEND” I will send you the link!", "SEND"),
        ("Comment ‘REPOS’ and I will send you all three", "REPOS"),  # noqa: RUF001
        ("Comment «THRONE» and I’ll send you the links", "THRONE"),  # noqa: RUF001
        ('Follow & Comment "levels" for hands-on projects', "levels"),
        ("comment JEV and follow for my free setup guide", "JEV"),
        ("Type 'guide' below", "guide"),
        ("Comment the ones I missed, comment “build” and I will send it", "build"),
        ("Comment below your favourite tool", None),
        ("Drop a 🔥 if you agree", None),
        ("A little motion can make a UI feel different.", None),
    ],
)
def test_detect_cta(caption: str, keyword: str | None) -> None:
    assert detect_cta(caption) == keyword


def test_url_expiry() -> None:
    assert url_expiry("https://x.fbcdn.net/v.mp4?oe=6A0A1B2C&_nc=1") == datetime.fromtimestamp(
        0x6A0A1B2C, UTC
    )
    assert url_expiry("https://x.fbcdn.net/v.mp4") is None
    assert url_expiry("https://x.fbcdn.net/v.mp4?oe=zz") is None
