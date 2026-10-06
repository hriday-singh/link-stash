"""Tests for triage CLI commands: the surface the agent skills call."""

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any, cast
from unittest.mock import patch

import pytest
from typer.testing import CliRunner

from stash.cli import app
from stash.config import Config

runner = CliRunner()


@pytest.fixture
def home(tmp_path: Path) -> Iterator[Path]:
    with patch("stash.cli.triage.load_config", return_value=Config(home=tmp_path)):
        yield tmp_path


def _ok(args: list[str], input: str | None = None) -> Any:
    result = runner.invoke(app, args, input=input)
    assert result.exit_code == 0, result.stderr
    return json.loads(result.stdout)


def _err(args: list[str], input: str | None = None) -> dict[str, dict[str, object]]:
    result = runner.invoke(app, args, input=input)
    assert result.exit_code == 2
    return json.loads(result.stderr)


def test_save_then_check_finds_duplicate(home: Path, tmp_path: Path) -> None:
    card = {
        "key": "github:acme/widget",
        "title": "Widget",
        "category": "repos-tools",
        "kind": "repo",
        "url": "https://github.com/acme/widget",
        "body": "A widget.",
    }
    f = tmp_path / "card.json"
    f.write_text(json.dumps(card), "utf-8")
    saved = _ok(["save", str(f)])
    assert saved["status"] == "saved"
    assert (home / saved["path"]).is_file()

    checked = _ok(["check", "-"], input=json.dumps({"key": "github:acme/widget"}))
    assert checked["status"] == "duplicate_library"


def test_save_rejects_bad_card(home: Path) -> None:
    err = _err(["save", "-"], input=json.dumps({"title": "no key"}))
    assert err["error"]["code"] == "invalid"


def test_check_rejects_non_object_json(home: Path) -> None:
    err = _err(["check", "-"], input="[1, 2]")
    assert err["error"]["code"] == "invalid"


def test_reject_then_check_reports_rejection(home: Path) -> None:
    rej = _ok(["reject", "github:acme/old", "--reason", "abandoned"])
    assert rej["reason"] == "abandoned"
    checked = _ok(["check", "-"], input=json.dumps({"key": "github:acme/old"}))
    assert checked["status"] == "previously_rejected"


def test_pending_add_list_resolve(home: Path) -> None:
    item = {"kind": "cta", "source_key": "ig:C123", "instruction": "comment GUIDE"}
    added = _ok(["pending", "add", "-"], input=json.dumps(item))
    assert added["id"].startswith("p-")

    listed = _ok(["pending", "list"])
    assert [p["id"] for p in listed] == [added["id"]]

    resolved = _ok(["pending", "resolve", added["id"], "--url", "https://github.com/acme/guide"])
    assert resolved["status"] == "ready"


def test_have_adds_manual_entry(home: Path) -> None:
    entry = _ok(["have", "[tool] Scrapling — stealth scraping"])
    assert entry["name"] == "Scrapling"
    assert any((home / "inventory" / "manual").glob("*.md"))


def test_scan_reports_fresh_and_counts(home: Path) -> None:
    with patch("stash.cli.triage.scan_inventory", return_value=None) as scan:
        assert _ok(["scan", "--if-stale"]) == {"status": "fresh"}
        scan.assert_called_once_with(home, if_stale=True)
    with patch("stash.cli.triage.scan_inventory", return_value={"ollama": 2}):
        assert _ok(["scan"]) == {"status": "scanned", "counts": {"ollama": 2}}


def test_extract_needs_links(home: Path) -> None:
    err = _err(["extract"])
    assert err["error"]["code"] == "invalid"


def test_extract_retry_failed_adds_logged_links(home: Path) -> None:
    with (
        patch("stash.cli.triage.failed_urls", return_value=["https://example.com/b"]),
        patch("stash.cli.triage.extract_urls", return_value=[]) as ext,
    ):
        assert _ok(["extract", "https://example.com/a", "--retry-failed"]) == {
            "count": 0,
            "sources": [],
        }
        ext.assert_called_once_with(home, ["https://example.com/a", "https://example.com/b"])


def test_install_skills_uses_given_dir(home: Path, tmp_path: Path) -> None:
    with patch("stash.cli.triage.install_skills", return_value={"t": ["stash"]}) as inst:
        assert _ok(["install-skills", "--skills-dir", str(tmp_path)]) == {"t": ["stash"]}
        inst.assert_called_once_with(tmp_path, mode="copy", workspace=False)


def test_install_skills_cli_flags(home: Path, tmp_path: Path) -> None:
    with patch("stash.cli.triage.install_skills", return_value={"t": ["stash"]}) as inst:
        assert _ok(
            ["install-skills", "--skills-dir", str(tmp_path), "--mode", "symlink", "--workspace"]
        ) == {"t": ["stash"]}
        inst.assert_called_once_with(tmp_path, mode="symlink", workspace=True)


def test_install_skills_invalid_mode(home: Path) -> None:
    err = _err(["install-skills", "--mode", "unknown"])
    assert err["error"]["code"] == "invalid"


def test_have_batch_via_stdin(home: Path) -> None:
    batch_input = "[tool] Alpha — first tool\n[ui_ref] Beta — second UI https://beta.design\n"
    res = _ok(["have", "-"], input=batch_input)
    assert isinstance(res, list)
    items = cast(list[dict[str, object]], res)
    assert len(items) == 2
    assert items[0]["name"] == "Alpha"
    assert items[1]["name"] == "Beta"


def test_check_raw_url_and_raw_name(home: Path) -> None:
    # First save an item into manual inventory
    _ok(["have", "[ui_ref] shadcn/ui — UI kit https://ui.shadcn.com"])

    # Checking directly by URL without JSON formatting
    checked_url = _ok(["check", "https://ui.shadcn.com"])
    assert checked_url["status"] in ("duplicate_inventory", "overlap")

    # Checking directly by name without JSON formatting
    checked_name = _ok(["check", "shadcn"])
    assert checked_name["status"] in ("duplicate_inventory", "overlap")

    # Checking non-existent thing
    checked_new = _ok(["check", "something-completely-brand-new-999"])
    assert checked_new["status"] == "new"


def test_save_with_flags_and_bucket(home: Path) -> None:
    saved = _ok([
        "save", "--url", "https://github.com/acme/widget", "--title", "Widget",
        "--category", "repos-tools", "--tag", "cli", "--tag", "rust",
        "--bucket", "try-now", "--body", "# Widget",
    ])  # fmt: skip
    text = (home / saved["path"]).read_text("utf-8")
    assert "bucket: try-now" in text
    assert "key: github:acme/widget" in text
    err = _err(["save", "--url", "https://x.example", "--title", "X",
                "--category", "c", "--bucket", "someday"])  # fmt: skip
    assert err["error"]["code"] == "invalid"


def test_pending_add_with_flags_and_alias(home: Path) -> None:
    item = _ok([
        "pending", "add", "--kind", "comment_for_link", "--source", "ig:abc",
        "--instruction", "Comment AGENT on the reel",
    ])  # fmt: skip
    assert item["kind"] == "cta"
    assert item["source_key"] == "ig:abc"
