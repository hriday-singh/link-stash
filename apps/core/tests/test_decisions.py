"""Decision log, `stash prefs` and the suggest boost."""

import json
from collections.abc import Iterator
from datetime import date
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from typer.testing import CliRunner

from stash.cli import app
from stash.config import Config
from stash.services.decisions import Decision, liked_tags, prefs_summary, read_decisions
from stash.services.suggest import CardSuggestion, boost_cards

runner = CliRunner()


@pytest.fixture
def home(tmp_path: Path) -> Iterator[Path]:
    with patch("stash.cli.triage.load_config", return_value=Config(home=tmp_path)):
        yield tmp_path


def _ok(args: list[str], input: str | None = None) -> Any:
    result = runner.invoke(app, args, input=input)
    assert result.exit_code == 0, result.stderr
    return json.loads(result.stdout)


def _d(final: str, proposed: str, **kw: Any) -> Decision:
    return Decision.model_validate(
        {"date": date(2026, 10, 10), "key": "k", "final": final, "proposed": proposed, **kw}
    )


SAVE_FLAGS = ["save", "--url", "https://github.com/acme/widget", "--title", "Widget"]


def test_save_with_proposed_logs_decision(home: Path) -> None:
    _ok([*SAVE_FLAGS, "--category", "repos-tools", "--tag", "cli", "--bucket", "later",
         "--source", "ig:C1", "--proposed", "save", "--proposed-bucket", "try-now",
         "--reason", "not needed today"])  # fmt: skip
    [d] = read_decisions(home)
    assert (d.key, d.final, d.proposed) == ("github:acme/widget", "save", "save")
    assert (d.bucket, d.proposed_bucket) == ("later", "try-now")
    assert d.tags == ["cli"] and d.sources == ["ig:C1"] and d.reason == "not needed today"
    assert d.is_override


def test_save_without_proposed_logs_nothing(home: Path) -> None:
    _ok([*SAVE_FLAGS, "--category", "repos-tools"])
    assert not (home / "library" / "decisions.jsonl").exists()


def test_batch_save_logs_per_card_and_keeps_card_clean(home: Path) -> None:
    cards = [
        {"url": "https://github.com/acme/a", "title": "A", "category": "repos-tools",
         "proposed": "ask", "body": "a"},
        {"url": "https://github.com/acme/b", "title": "B", "category": "repos-tools",
         "body": "b"},
    ]  # fmt: skip
    rows = _ok(["save", "-"], input=json.dumps(cards))
    assert [d.key for d in read_decisions(home)] == ["github:acme/a"]
    card_text = (home / rows[0]["path"]).read_text("utf-8")
    assert "proposed" not in card_text


def test_bad_proposed_fails_before_saving(home: Path) -> None:
    result = runner.invoke(app, [*SAVE_FLAGS, "--category", "x", "--proposed", "maybe"])
    assert result.exit_code == 2
    assert not (home / "library" / "items").exists()


def test_reject_with_proposed_logs_decision(home: Path) -> None:
    _ok(["reject", "github:acme/kit", "--reason", "paid, no free tier",
         "--proposed", "save", "--category", "ui-ux"])  # fmt: skip
    [d] = read_decisions(home)
    assert (d.final, d.proposed, d.category, d.reason) == (
        "reject", "save", "ui-ux", "paid, no free tier",
    )  # fmt: skip


def test_override_rules() -> None:
    assert _d("reject", "save").is_override
    assert not _d("reject", "ask").is_override
    assert not _d("save", "save", bucket="later", proposed_bucket="later").is_override
    assert _d("save", "ask", bucket="later", proposed_bucket="try-now").is_override


def test_liked_tags_thresholds() -> None:
    four_of_five = [_d("save", "save", tags=["mcp"])] * 4 + [_d("reject", "save", tags=["mcp"])]
    two_saves = [_d("save", "save", tags=["css"])] * 2
    three_of_five = [_d("save", "save", tags=["kit"])] * 3 + [_d("reject", "ask", tags=["kit"])] * 2
    assert liked_tags(four_of_five + two_saves + three_of_five) == ["mcp"]


def test_prefs_summary_empty_and_seed(home: Path) -> None:
    empty = prefs_summary(home)
    assert (empty["decisions"], empty["rules"]) == (0, None)
    (home / "library").mkdir()
    (home / "library" / "preferences.md").write_text("- [reject] paywalls", "utf-8")
    assert prefs_summary(home)["rules"] == "- [reject] paywalls"
    _ok([*SAVE_FLAGS, "--category", "repos-tools", "--bucket", "try-now", "--tag", "cli"])
    _ok(["reject", "github:acme/kit", "--reason", "paid"])
    out = _ok(["prefs", "--seed"])
    lib = out["library"]
    assert lib["cards_by_category"] == {"repos-tools": 1}
    assert lib["cards_by_bucket"] == {"try-now": 1}
    assert lib["top_tags"] == [{"tag": "cli", "count": 1}]
    assert lib["rejects"] == [{"key": "github:acme/kit", "reason": "paid"}]


def test_prefs_counts_overrides(home: Path) -> None:
    _ok(["reject", "a", "--reason", "dead", "--proposed", "reject", "--category", "ui-ux"])
    _ok(["reject", "b", "--reason", "paywall", "--proposed", "save", "--category", "ui-ux"])
    out = _ok(["prefs"])
    assert (out["decisions"], out["overrides"], out["override_rate"]) == (2, 1, 0.5)
    assert out["recent_overrides"][0]["reason"] == "paywall"
    assert out["by_category"] == {"ui-ux": {"saved": 0, "rejected": 2}}


def _card(slug: str, bucket: str | None = None, tags: list[str] | None = None) -> CardSuggestion:
    return CardSuggestion(
        title=slug, slug=slug, category="c", kind="tool", tags=tags or [], bucket=bucket
    )


def test_boost_breaks_near_ties_only() -> None:
    cards = [_card("plain"), _card("liked", "try-now", ["mcp"]), _card("third")]
    assert [c.slug for c in boost_cards(cards, {"mcp"})] == ["liked", "plain", "third"]
    far = [_card("a"), _card("b"), _card("c"), _card("d", "try-now", ["mcp"])]
    assert [c.slug for c in boost_cards(far, {"mcp"})] == ["a", "b", "d", "c"]
    assert [c.slug for c in boost_cards(cards, set())] == ["plain", "liked", "third"]
