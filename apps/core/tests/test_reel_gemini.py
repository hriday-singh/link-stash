import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from stash.reel.agy import ReelEngineError
from stash.reel.gemini_api import build_gemini_prompt, run_gemini_api


def test_build_gemini_prompt():
    prompt = build_gemini_prompt("Base rules", caption="Check out this tool", creator="@techdev")
    assert "Base rules" in prompt
    assert "@techdev" in prompt
    assert "Check out this tool" in prompt


def test_missing_video_file(tmp_path: Path):
    nonexistent = tmp_path / "video.mp4"
    with pytest.raises(ReelEngineError) as exc_info:
        run_gemini_api(nonexistent, api_key="dummy")
    assert "Video file not found" in str(exc_info.value)


def test_missing_api_key(tmp_path: Path):
    video = tmp_path / "video.mp4"
    video.write_bytes(b"dummy video data")
    with patch.dict("os.environ", {}, clear=True):
        with pytest.raises(ReelEngineError) as exc_info:
            run_gemini_api(video)
        assert "GEMINI_API_KEY environment variable missing" in str(exc_info.value)


def test_gemini_inline_small_video(tmp_path: Path):
    video = tmp_path / "video.mp4"
    video.write_bytes(b"small mp4 data")

    expected_payload: dict[str, object] = {
        "summary": "Demonstration of HydraFusion AI framework.",
        "transcript_source": "audio",
        "on_screen_text": ["Terminal-Bench 2.1"],
        "mentions": [
            {
                "kind": "repo",
                "name": "HydraFusion",
                "url": "https://gh.io/HydraFusion",
                "evidence": "on_screen",
            }
        ],
        "features": {},
        "takeaways": ["67% lower cost"],
        "engine": "gemini-api",
        "confidence": "high",
    }

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = json.dumps(expected_payload)
    mock_client.models.generate_content.return_value = mock_response

    record = run_gemini_api(
        video_path=video,
        caption="67% lower cost with HydraFusion",
        creator="@ai_daily",
        api_key="test_key",
        client=mock_client,
    )

    assert record.summary == "Demonstration of HydraFusion AI framework."
    assert record.engine == "gemini-api"
    assert len(record.mentions) == 1
    assert record.mentions[0].name == "HydraFusion"
    assert mock_client.files.upload.call_count == 0
    assert mock_client.models.generate_content.call_count == 1


def test_gemini_large_video_files_api(tmp_path: Path):
    video = tmp_path / "large_video.mp4"
    # Create file >= 20 MB (20 * 1024 * 1024 + 10 bytes) sparse or seeking
    with open(video, "wb") as f:
        f.seek(20 * 1024 * 1024 + 10)
        f.write(b"\0")

    expected_payload: dict[str, object] = {
        "summary": "Long reel video analysis.",
        "transcript_source": "none",
        "on_screen_text": [],
        "mentions": [],
        "features": {},
        "takeaways": [],
        "engine": "gemini-api",
        "confidence": "high",
    }

    mock_client = MagicMock()
    mock_file = MagicMock()
    mock_file.state = "ACTIVE"
    mock_file.name = "files/test1234"
    mock_client.files.upload.return_value = mock_file

    mock_response = MagicMock()
    mock_response.text = json.dumps(expected_payload)
    mock_client.models.generate_content.return_value = mock_response

    record = run_gemini_api(
        video_path=video,
        api_key="test_key",
        client=mock_client,
    )

    assert record.summary == "Long reel video analysis."
    assert mock_client.files.upload.call_count == 1
    assert mock_client.models.generate_content.call_count == 1


def test_gemini_api_error_handling(tmp_path: Path):
    video = tmp_path / "video.mp4"
    video.write_bytes(b"sample data")

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = RuntimeError("Resource exhausted: 429 quota")

    with pytest.raises(ReelEngineError) as exc_info:
        run_gemini_api(video, api_key="key", client=mock_client)

    assert "generate_content failed" in str(exc_info.value)
    assert "429" in str(exc_info.value)
