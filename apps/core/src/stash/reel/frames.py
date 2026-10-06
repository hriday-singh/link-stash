"""Frames fallback engine: scene-detected contact sheet generation via ffmpeg."""

import shutil
import subprocess
from pathlib import Path

from stash.reel.agy import ReelEngineError


def build_ffmpeg_tile_command(
    video_path: Path,
    output_path: Path,
    max_frames: int = 12,
    ffmpeg_bin: str = "ffmpeg",
) -> list[str]:
    """Constructs the ffmpeg command to extract scene frames and tile them with timestamps."""
    rows = -(-max_frames // 3)
    # Opening frame + every scene cut + at least one frame per 5 s (talking heads have no cuts).
    # ponytail: tile keeps the first max_frames; a long reel with many cuts loses its tail.
    filter_complex = (
        "select='isnan(prev_selected_t)+gt(scene,0.3)+gte(t-prev_selected_t,5)',scale=480:-1,"
        "drawtext=text='%{pts\\:hms}':x=10:y=H-th-10:fontcolor=white:fontsize=24:box=1:boxcolor=black@0.6,"
        f"tile=3x{rows}"
    )
    return [
        ffmpeg_bin,
        "-y",
        "-i",
        str(video_path),
        "-vf",
        filter_complex,
        "-frames:v",
        "1",
        str(output_path),
    ]


def generate_contact_sheet(
    video_path: Path,
    output_path: Path,
    max_frames: int = 12,
    ffmpeg_bin: str | None = None,
) -> Path:
    """Generates a labeled contact sheet image (contact.jpg) from reel video using ffmpeg."""
    bin_path = ffmpeg_bin or shutil.which("ffmpeg")
    if not bin_path:
        raise ReelEngineError(
            "ffmpeg executable not found on PATH",
            {"engine": "frames", "video_path": str(video_path)},
        )

    if not video_path.is_file():
        raise ReelEngineError(
            f"Video file not found: {video_path}",
            {"engine": "frames", "video_path": str(video_path)},
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = build_ffmpeg_tile_command(
        video_path=video_path,
        output_path=output_path,
        max_frames=max_frames,
        ffmpeg_bin=bin_path,
    )

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
    except OSError as e:
        raise ReelEngineError(
            f"Failed to execute ffmpeg: {e}",
            {"engine": "frames", "error": str(e)},
        ) from e

    if proc.returncode != 0:
        rows = -(-max_frames // 3)
        # If scene selection produced no frames or failed, retry with uniform fps sampling
        fallback_filter = (
            # Label before fps: fps re-stamps frames, so a later label drifts from source time.
            "drawtext=text='%{pts\\:hms}':x=10:y=H-th-10:fontcolor=white:fontsize=h/20:box=1:boxcolor=black@0.6,"
            "fps=1/5,scale=480:-1,"
            f"tile=3x{rows}"
        )
        fallback_cmd = [
            bin_path,
            "-y",
            "-i",
            str(video_path),
            "-vf",
            fallback_filter,
            "-frames:v",
            "1",
            str(output_path),
        ]
        proc = subprocess.run(fallback_cmd, capture_output=True, text=True, encoding="utf-8")
        if proc.returncode != 0:
            raise ReelEngineError(
                f"ffmpeg failed to generate contact sheet (exit code {proc.returncode})",
                {"engine": "frames", "stderr": proc.stderr.strip()},
            )

    return output_path
