import json
from pathlib import Path

import pytest
from starlette.testclient import TestClient
from typer.testing import CliRunner

from stash.cli import app
from stash.config import Config
from stash.server.app import create_app

runner = CliRunner()


def test_cli_openapi(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    home = tmp_path / "stash"
    home.mkdir()
    monkeypatch.setenv("STASH_HOME", str(home))

    result = runner.invoke(app, ["openapi"])
    assert result.exit_code == 0
    schema = json.loads(result.output)
    assert schema["info"]["title"] == "Link Stash Library API"
    assert "/api/cards" in schema["paths"]
    assert "/api/events" in schema["paths"]


def test_cli_serve_missing_dist(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    home = tmp_path / "stash"
    home.mkdir()
    monkeypatch.setenv("STASH_HOME", str(home))
    # Point web_dist to non-existent folder
    fake_dist = tmp_path / "non_existent_dist"

    cfg_file = home / "config.toml"
    cfg_file.write_text(f'web_dist = "{fake_dist.as_posix()}"\n', encoding="utf-8")

    result = runner.invoke(app, ["serve"])
    assert result.exit_code == 1
    assert "Web app distribution not found" in result.output


def test_spa_serving(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text(
        "<!DOCTYPE html><html><body>Link Stash SPA</body></html>", encoding="utf-8"
    )

    cfg = Config(home=home, web_dist=dist)
    spa_app = create_app(cfg, dev=False)
    client = TestClient(spa_app, base_url="http://127.0.0.1")

    # Root route returns SPA index.html
    resp_root = client.get("/")
    assert resp_root.status_code == 200
    assert "Link Stash SPA" in resp_root.text

    # Client-side router path returns index.html
    resp_client_route = client.get("/c/some-slug")
    assert resp_client_route.status_code == 200
    assert "Link Stash SPA" in resp_client_route.text

    # Unknown /api/ path returns JSON 404, not HTML!
    resp_api = client.get("/api/unknown")
    assert resp_api.status_code == 404
    assert resp_api.json()["error"]["code"] == "not_found"
