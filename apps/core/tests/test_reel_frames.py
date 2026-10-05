from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from stash.reel.agy import ReelEngineError
from stash.reel.frames import build_ffmpeg_tile_command, generate_contact_sheet


def test_build_ffmpeg_tile_command():
    video = Path("/test/video.mp4")
    out = Path("/test/contact.jpg")
    cmd = build_ffmpeg_tile_command(video, out, max_frames=12, ffmpeg_bin="ffmpeg")
    assert cmd[0] == "ffmpeg"
    assert str(video) in cmd
    assert str(out) in cmd
    assert any("tile=3x4" in arg for arg in cmd)
    assert any("drawtext=" in arg for arg in cmd)


def test_missing_ffmpeg(tmp_path: Path):
    video = tmp_path / "video.mp4"
    video.write_bytes(b"data")
    out = tmp_path / "contact.jpg"
    with patch("shutil.which", return_value=None):
        with pytest.raises(ReelEngineError) as exc_info:
            generate_contact_sheet(video, out)
        assert "ffmpeg executable not found" in str(exc_info.value)


def test_missing_video(tmp_path: Path):
    video = tmp_path / "nonexistent.mp4"
    out = tmp_path / "contact.jpg"
    with patch("shutil.which", return_value="/bin/ffmpeg"):
        with pytest.raises(ReelEngineError) as exc_info:
            generate_contact_sheet(video, out)
        assert "Video file not found" in str(exc_info.value)


def test_successful_generate_contact_sheet(tmp_path: Path):
    video = tmp_path / "video.mp4"
    video.write_bytes(b"sample video bytes")
    out = tmp_path / "contact.jpg"

    mock_proc = MagicMock()
    mock_proc.returncode = 0

    with (
        patch("shutil.which", return_value="/bin/ffmpeg"),
        patch("subprocess.run", return_value=mock_proc) as mock_run,
    ):
        result = generate_contact_sheet(video, out)
        assert result == out
        assert mock_run.call_count == 1


def test_ffmpeg_fallback_to_uniform_fps(tmp_path: Path):
    video = tmp_path / "video.mp4"
    video.write_bytes(b"sample video bytes")
    out = tmp_path / "contact.jpg"

    # First call fails (e.g. no scene changes detected), second call succeeds
    fail_proc = MagicMock()
    fail_proc.returncode = 1
    fail_proc.stderr = "No scene frames found"

    success_proc = MagicMock()
    success_proc.returncode = 0

    with (
        patch("shutil.which", return_value="/bin/ffmpeg"),
        patch("subprocess.run", side_effect=[fail_proc, success_proc]) as mock_run,
    ):
        result = generate_contact_sheet(video, out)
        assert result == out
        assert mock_run.call_count == 2
        # Verify second command used fps fallback
        fallback_cmd = mock_run.call_args_list[1][0][0]
        assert any("fps=" in arg for arg in fallback_cmd)


def test_ffmpeg_fatal_failure(tmp_path: Path):
    video = tmp_path / "video.mp4"
    video.write_bytes(b"sample video bytes")
    out = tmp_path / "contact.jpg"

    fail_proc = MagicMock()
    fail_proc.returncode = 1
    fail_proc.stderr = "Fatal decoding error"

    with (
        patch("shutil.which", return_value="/bin/ffmpeg"),
        patch("subprocess.run", return_value=fail_proc),
    ):
        with pytest.raises(ReelEngineError) as exc_info:
            generate_contact_sheet(video, out)
        assert "ffmpeg failed to generate contact sheet" in str(exc_info.value)
