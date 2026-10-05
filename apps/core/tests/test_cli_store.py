"""Tests for store CLI commands (stash reindex)."""

import json
from pathlib import Path
from unittest.mock import patch

from typer.testing import CliRunner

from stash.cli import app
from stash.config import Config
from stash.errors import StashError
from stash.store.cards import save_card
from stash.store.models import Card

runner = CliRunner()


def test_cli_reindex_success(tmp_path: Path) -> None:
    cfg = Config(home=tmp_path)
    card = Card(
        schema=1,
        key="github:test/cli",
        title="CLI Test Card",
        category="repos-tools",
        kind="repo",
        added="2026-10-05",  # type: ignore[arg-type]
    )
    save_card(tmp_path, card, "body")

    with patch("stash.cli.store.load_config", return_value=cfg):
        result = runner.invoke(app, ["reindex"])
        assert result.exit_code == 0
        data = json.loads(result.stdout)
        assert data["status"] == "ok"
        assert data["indexed"]["cards"] == 1
        assert data["indexed"]["sources"] == 0


def test_cli_reindex_error(tmp_path: Path) -> None:
    cfg = Config(home=tmp_path)

    with (
        patch("stash.cli.store.load_config", return_value=cfg),
        patch("stash.cli.store.rebuild", side_effect=StashError("test_code", "test failure")),
    ):
        result = runner.invoke(app, ["reindex"])
        assert result.exit_code == 2
        err_data = json.loads(result.stderr)
        assert err_data["error"]["code"] == "test_code"
        assert "test failure" in err_data["error"]["message"]
