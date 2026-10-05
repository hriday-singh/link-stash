"""Identity keys. One key per thing, whatever URL form it arrived in."""

import re
from pathlib import Path

from stash.errors import Invalid

_IG = re.compile(
    r"^https?://(?:www\.|m\.)?instagram\.com/(?:[\w.]+/)?(reels?|p|tv)/([\w-]+)/?(?:[?#].*)?$",
    re.IGNORECASE,
)


def parse_ig_url(url: str) -> tuple[str, str]:
    """Return (kind, shortcode); kind is "reel" or "p". `/reels/` and `/tv/` collapse to reel."""
    m = _IG.match(url.strip())
    if not m:
        raise Invalid("not an Instagram post or reel URL", {"url": url})
    kind = "p" if m.group(1).lower() == "p" else "reel"
    return kind, m.group(2)


def ig_key(url: str) -> str:
    return f"ig:{parse_ig_url(url)[1]}"


def source_dir(home: Path, key: str) -> Path:
    """`ig:ABC` -> `<home>/library/sources/ig-ABC`."""
    return home / "library" / "sources" / key.replace(":", "-", 1)
