import json
import re
from pathlib import Path
from unittest.mock import patch

from typer.testing import CliRunner

from stash.cli import app
from stash.errors import NotFound
from stash.reel.models import ReelRecord

runner = CliRunner(env={"NO_COLOR": "1"})


def make_dummy_record() -> ReelRecord:
    return ReelRecord(
        summary="CLI test analysis.",
        transcript_source="none",
        on_screen_text=["$ command"],
        mentions=[],
        features={},
        takeaways=[],
        engine="agy-headless",
        confidence="high",
    )


def test_cli_analyze_help():
    result = runner.invoke(app, ["analyze", "--help"])
    assert result.exit_code == 0
    clean_out = re.sub(r"\x1b\[[0-9;]*[a-zA-Z]", "", result.stdout)
    assert "Analyze a downloaded reel video" in clean_out
    assert "--engine" in clean_out


def test_cli_ingest_help():
    result = runner.invoke(app, ["ingest", "--help"])
    assert result.exit_code == 0
    assert "Ingest raw structured reel JSON" in result.stdout


def test_cli_analyze_success():
    with patch("stash.cli.reel.analyze_reel", return_value=make_dummy_record()) as mock_analyze:
        result = runner.invoke(app, ["analyze", "src123"])
        assert result.exit_code == 0
        data = json.loads(result.stdout)
        assert data["summary"] == "CLI test analysis."
        assert mock_analyze.call_count == 1


def test_cli_analyze_with_engine():
    with patch("stash.cli.reel.analyze_reel", return_value=make_dummy_record()) as mock_analyze:
        result = runner.invoke(app, ["analyze", "src123", "--engine", "gemini_api"])
        assert result.exit_code == 0
        mock_analyze.assert_called_once()
        assert mock_analyze.call_args[1].get("engine") == "gemini_api"


def test_cli_analyze_error():
    with patch("stash.cli.reel.analyze_reel", side_effect=NotFound("Source not found")):
        result = runner.invoke(app, ["analyze", "missing"])
        assert result.exit_code == 2
        assert "not_found" in result.stderr


def test_cli_ingest_from_file(tmp_path: Path):
    json_file = tmp_path / "record.json"
    dummy = make_dummy_record()
    json_file.write_text(dummy.model_dump_json(), encoding="utf-8")

    with patch("stash.cli.reel.ingest_reel", return_value=dummy) as mock_ingest:
        result = runner.invoke(app, ["ingest", "src123", str(json_file)])
        assert result.exit_code == 0
        data = json.loads(result.stdout)
        assert data["summary"] == "CLI test analysis."
        assert mock_ingest.call_count == 1


def test_cli_ingest_from_stdin():
    dummy = make_dummy_record()
    raw_text = dummy.model_dump_json()

    with patch("stash.cli.reel.ingest_reel", return_value=dummy) as mock_ingest:
        result = runner.invoke(app, ["ingest", "src123", "-"], input=raw_text)
        assert result.exit_code == 0
        data = json.loads(result.stdout)
        assert data["summary"] == "CLI test analysis."
        assert mock_ingest.call_count == 1
