import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from stash.reel.agy import ReelEngineError, run_agy_headless


def test_missing_agy_binary(tmp_path: Path):
    with patch("shutil.which", return_value=None):
        with pytest.raises(ReelEngineError) as exc_info:
            run_agy_headless(tmp_path)
        assert "not found on PATH" in str(exc_info.value)
        assert exc_info.value.details.get("engine") == "agy-headless"


def test_missing_prompt_path(tmp_path: Path):
    with patch("shutil.which", return_value="/bin/agy"):
        missing_prompt = tmp_path / "nonexistent.md"
        with pytest.raises(ReelEngineError) as exc_info:
            run_agy_headless(tmp_path, prompt_path=missing_prompt)
        assert "Prompt file not found" in str(exc_info.value)


def test_agy_process_nonzero_exit(tmp_path: Path):
    mock_proc = MagicMock()
    mock_proc.returncode = 1
    mock_proc.stderr = "Permission denied or failed to open reel"
    mock_proc.stdout = ""

    with (
        patch("shutil.which", return_value="/bin/agy"),
        patch("subprocess.run", return_value=mock_proc),
    ):
        with pytest.raises(ReelEngineError) as exc_info:
            run_agy_headless(tmp_path)
        assert "exited with code 1" in str(exc_info.value)
        assert "Permission denied" in str(exc_info.value.details.get("stderr"))


def test_agy_process_timeout(tmp_path: Path):
    with (
        patch("shutil.which", return_value="/bin/agy"),
        patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd=["agy"], timeout=300)),
    ):
        with pytest.raises(ReelEngineError) as exc_info:
            run_agy_headless(tmp_path)
        assert "timed out after 300 seconds" in str(exc_info.value)


def test_agy_invalid_json(tmp_path: Path):
    mock_proc = MagicMock()
    mock_proc.returncode = 0
    mock_proc.stdout = "This is not valid json text at all"
    mock_proc.stderr = ""

    with (
        patch("shutil.which", return_value="/bin/agy"),
        patch("subprocess.run", return_value=mock_proc),
    ):
        with pytest.raises(ReelEngineError) as exc_info:
            run_agy_headless(tmp_path)
        assert "Failed to parse agy JSON output" in str(exc_info.value)


def test_agy_successful_direct_json(tmp_path: Path):
    valid_payload = {
        "summary": "Demonstration of gh-secure tool.",
        "transcript_source": "none",
        "on_screen_text": ["$ gh secure status"],
        "mentions": [
            {
                "kind": "tool",
                "name": "gh-secure",
                "url": "https://gh.io/gh-secure",
                "evidence": "on_screen",
            }
        ],
        "features": {"gh-secure": ["secret scanning"]},
        "takeaways": ["One command protection"],
        "cta": {"type": "comment", "keyword": "SECURE"},
        "engine": "agy-headless",
        "confidence": "high",
    }

    mock_proc = MagicMock()
    mock_proc.returncode = 0
    mock_proc.stdout = json.dumps(valid_payload)
    mock_proc.stderr = ""

    with (
        patch("shutil.which", return_value="/bin/agy"),
        patch("subprocess.run", return_value=mock_proc),
    ):
        record = run_agy_headless(tmp_path)
        assert record.summary == "Demonstration of gh-secure tool."
        assert len(record.mentions) == 1
        assert record.mentions[0].name == "gh-secure"
        assert record.engine == "agy-headless"


def test_agy_successful_wrapped_structured_output(tmp_path: Path):
    valid_payload: dict[str, object] = {
        "summary": "Demonstration with structured_output wrapper.",
        "transcript_source": "audio",
        "on_screen_text": [],
        "mentions": [],
        "features": {},
        "takeaways": [],
        "engine": "agy-headless",
        "confidence": "high",
    }

    mock_proc = MagicMock()
    mock_proc.returncode = 0
    mock_proc.stdout = json.dumps({"structured_output": valid_payload})
    mock_proc.stderr = ""

    with (
        patch("shutil.which", return_value="/bin/agy"),
        patch("subprocess.run", return_value=mock_proc),
    ):
        record = run_agy_headless(tmp_path)
        assert record.summary == "Demonstration with structured_output wrapper."
        assert record.transcript_source == "audio"
        assert record.engine == "agy-headless"
