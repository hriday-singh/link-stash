"""Unit tests for check and deduplication service."""

from datetime import date
from pathlib import Path

from stash.services.check import CheckInput, check_item
from stash.services.rejects import add_reject
from stash.store.cards import save_card
from stash.store.models import Card


def test_check_new_item(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    inp = CheckInput(key="github:fresh/repo", title="Fresh Tool", kind="repo")
    result = check_item(home, inp)
    assert result.status == "new"
    assert result.existing_slug is None


def test_check_duplicate_card(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    card = Card(
        schema=1,
        key="github:owner/repo",
        title="Existing Tool",
        category="repos-tools",
        kind="repo",
        added=date(2026, 10, 5),
        url="https://github.com/owner/repo",
    )
    save_card(home, card, "# Existing Tool", "existing-tool")

    inp = CheckInput(
        key="github:owner/repo",
        title="Existing Tool",
        kind="repo",
        url="https://github.com/owner/repo",
    )
    result = check_item(home, inp)
    assert result.status == "duplicate_library"
    assert result.existing_slug == "existing-tool"


def test_check_duplicate_reject(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    add_reject(home, "github:bad/tool", "Not maintained")

    inp = CheckInput(key="github:bad/tool", title="Bad Tool", kind="tool")
    result = check_item(home, inp)
    assert result.status == "previously_rejected"
    assert result.reject_reason == "Not maintained"


def test_check_overlap_detection(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    card = Card(
        schema=1,
        key="github:scrapling/scrapling",
        title="Scrapling",
        category="repos-tools",
        kind="tool",
        added=date(2026, 10, 5),
    )
    save_card(home, card, "# Scrapling", "scrapling")

    # Checking a tool with similar name
    inp = CheckInput(key="github:other/scrapling-fast", title="Scrapling Fast", kind="tool")
    result = check_item(home, inp)
    assert result.status == "overlap"
    assert len(result.overlaps) >= 1
    assert result.overlaps[0].name_or_title == "Scrapling"


def test_name_score_penalizes_single_word_subset() -> None:
    from stash.services.check import MIN_SCORE, name_score

    assert name_score("awesome-system-design-resources", "design") < MIN_SCORE
    assert name_score("shadcn", "shadcn/ui") >= MIN_SCORE
    assert name_score("Kokonut UI", "kokonut ui pro") >= MIN_SCORE


def test_check_shared_tag_is_candidate_despite_different_name(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()
    card = Card(
        schema=1,
        key="url:kokonutui.com",
        title="Kokonut UI",
        category="ui-ux",
        kind="tool",
        tags=["tailwind-components"],
        added=date(2026, 10, 5),
    )
    save_card(home, card, "# Kokonut UI", "kokonut-ui")

    result = check_item(
        home, CheckInput(title="Componentry", kind="tool", tags=["tailwind-components"])
    )
    assert result.status == "overlap"
    assert result.candidates[0].name_or_title == "Kokonut UI"
    assert result.candidates[0].shared_tags == ["tailwind-components"]

    unrelated = check_item(home, CheckInput(title="Componentry", kind="tool", tags=["cli"]))
    assert unrelated.status == "new"


def test_check_live_attaches_health(tmp_path: Path) -> None:
    from unittest.mock import patch

    from stash.services.health import Health

    home = tmp_path / "stash"
    home.mkdir()
    with patch("stash.services.check.probe", return_value=Health(status="dead")) as p:
        result = check_item(home, CheckInput(url="https://gone.example/x"), live=True)
        assert result.health is not None and result.health.status == "dead"
        assert check_item(home, CheckInput(url="https://gone.example/x")).health is None
        assert p.call_count == 1
