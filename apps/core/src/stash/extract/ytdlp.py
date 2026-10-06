"""Burner-cookie fallback: yt-dlp with a throwaway account's cookies.txt, used only when the
logged-out embed page is blocked. Flagged accounts are detected and switched off for good."""

from pathlib import Path
from typing import Any, cast

from pydantic import BaseModel
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

from stash.errors import Blocked

# Instagram's answer once it suspects the burner: stop using it, do not retry.
_FLAGGED = ("feedback_required", "checkpoint", "challenge_required")


class BurnerFlagged(Blocked):
    def __init__(self, message: str):
        super().__init__(message, {"reason": "burner_flagged"})


class YtdlpRecord(BaseModel):
    author: str | None = None
    caption: str | None = None
    files: list[str]


def fetch_with_cookies(url: str, dest: Path, cookies: Path) -> YtdlpRecord:
    """Download the post's video to dest/video.mp4. Raises Blocked or BurnerFlagged."""
    dest.mkdir(parents=True, exist_ok=True)
    opts: Any = {
        "cookiefile": str(cookies),
        "outtmpl": str(dest / "video.mp4"),
        # ponytail: one progressive file, no ffmpeg merge; DASH-only posts go to manual mp4.
        "format": "b[ext=mp4]/b",
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "socket_timeout": 60,
    }
    try:
        with YoutubeDL(opts) as ydl:
            info = cast(dict[str, Any] | None, ydl.extract_info(url, download=True))
    except DownloadError as e:
        msg = str(e)
        if any(f in msg for f in _FLAGGED):
            raise BurnerFlagged(msg) from e
        raise Blocked(f"yt-dlp failed: {msg}", {"reason": "ytdlp"}) from e
    if not info or not (dest / "video.mp4").is_file():
        raise Blocked("yt-dlp returned no video", {"reason": "ytdlp_no_video"})
    return YtdlpRecord(
        author=info.get("uploader_id") or info.get("channel") or info.get("uploader"),
        caption=info.get("description"),
        files=["video.mp4"],
    )
