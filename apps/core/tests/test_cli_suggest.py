"""Tests for stash suggest CLI command."""

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from stash.cli import app
from stash.config import Config
from stash.store.index import reindex_path

runner = CliRunner()


def test_cli_suggest_help() -> None:
    result = runner.invoke(app, ["suggest", "--help"])
    assert result.exit_code == 0
    assert "Suggest installed tools, saved library cards, and practices" in result.output


def test_cli_suggest_json_and_text(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:

    home = tmp_path
    monkeypatch.setattr("stash.cli.suggest.load_config", lambda: Config(home=home))

    inv_dir = home / "inventory" / "manual"
    inv_dir.mkdir(parents=True)
    (inv_dir / "ui-ux.md").write_text(
        "- [ui_ref] Lenis — Smooth scrolling library (key: url:lenis.dev)\n",
        encoding="utf-8",
    )
    reindex_path(home, inv_dir / "ui-ux.md")

    # 1. JSON output
    res_json = runner.invoke(app, ["suggest", "smooth scrolling"])
    assert res_json.exit_code == 0
    data = json.loads(res_json.output)
    assert data["found"] is True
    assert data["installed"][0]["name"] == "Lenis"

    # 2. Text output
    res_text = runner.invoke(app, ["suggest", "smooth scrolling", "--text"])
    assert res_text.exit_code == 0
    assert "Installed & Available in Inventory" in res_text.output
    assert "Lenis" in res_text.output

    # 3. Not found text output
    res_empty = runner.invoke(app, ["suggest", "kubernetes helm", "--text"])
    assert res_empty.exit_code == 0
    assert "No relevant items found in stash" in res_empty.output
