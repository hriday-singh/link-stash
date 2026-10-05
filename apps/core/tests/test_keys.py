from pathlib import Path

import pytest

from stash.errors import Invalid
from stash.store.keys import ig_key, parse_ig_url, source_dir


@pytest.mark.parametrize(
    "url",
    [
        "https://www.instagram.com/reel/DdjtsVnEVEU/",
        "https://www.instagram.com/reel/DdjtsVnEVEU",
        "https://instagram.com/reels/DdjtsVnEVEU/?igsh=abc",
        "https://www.instagram.com/tv/DdjtsVnEVEU/",
        "https://www.instagram.com/some.creator/reel/DdjtsVnEVEU/?utm_source=ig_web_copy_link",
        "https://www.instagram.com/reel/DdjtsVnEVEU/?stkn=MjUwdDI3Y3k4cjRo",
        "  https://m.instagram.com/reel/DdjtsVnEVEU/#x  ",
    ],
)
def test_reel_variants_share_one_key(url: str) -> None:
    assert ig_key(url) == "ig:DdjtsVnEVEU"
    assert parse_ig_url(url)[0] == "reel"


def test_post_with_dash_underscore_and_img_index() -> None:
    url = "https://www.instagram.com/p/Dd_1m-8iKAF/?img_index=8&stkn=NnkyYzV4"
    assert parse_ig_url(url) == ("p", "Dd_1m-8iKAF")


@pytest.mark.parametrize(
    "url",
    [
        "https://www.instagram.com/someone/",
        "https://example.com/reel/ABC/",
        "https://www.instagram.com/p/AAA/https://www.instagram.com/p/BBB/",
        "not a url",
    ],
)
def test_rejects(url: str) -> None:
    with pytest.raises(Invalid):
        ig_key(url)


def test_source_dir(tmp_path: Path) -> None:
    assert source_dir(tmp_path, "ig:Dd_1m-8iKAF") == tmp_path / "library/sources/ig-Dd_1m-8iKAF"
