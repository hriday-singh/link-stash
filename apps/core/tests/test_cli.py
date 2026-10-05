import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from stash.cli import app

runner = CliRunner()


def _which_all(name: str) -> str:
    return f"/bin/{name}"


def _which_no_agy(name: str) -> str | None:
    return None if name == "agy" else f"/bin/{name}"


@pytest.fixture(autouse=True)
def home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv("STASH_HOME", str(tmp_path))
    return tmp_path


def test_help() -> None:
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "doctor" in result.output


def test_doctor_all_tools_present(home: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("shutil.which", _which_all)
    result = runner.invoke(app, ["doctor"])
    assert result.exit_code == 0
    data = json.loads(result.stdout)
    assert data["home"] == str(home.resolve())
    assert data["home_exists"] is True
    assert data["tools"] == {"ffmpeg": "/bin/ffmpeg", "agy": "/bin/agy", "gh": "/bin/gh"}


def test_doctor_missing_tool_exits_1(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("shutil.which", _which_no_agy)
    result = runner.invoke(app, ["doctor"])
    assert result.exit_code == 1
    assert json.loads(result.stdout)["tools"]["agy"] is None


def test_bad_config_prints_error_shape(home: Path) -> None:
    (home / "config.toml").write_text("port = ", encoding="utf-8")
    result = runner.invoke(app, ["doctor"])
    assert result.exit_code == 2
    assert json.loads(result.stderr)["error"]["code"] == "invalid"
