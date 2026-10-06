"""Tests for stash suggest service."""

from datetime import date
from pathlib import Path

from stash.services.suggest import suggest_items
from stash.store.cards import save_card
from stash.store.index import reindex_path
from stash.store.models import Card


def test_suggest_returns_partitioned_results_and_skip_flag(tmp_path: Path) -> None:
    home = tmp_path

    # 1. Create inventory
    inv_dir = home / "inventory" / "manual"
    inv_dir.mkdir(parents=True)
    (inv_dir / "ui-ux.md").write_text(
        "- [ui_ref] Motion — Smooth React motion and animation (key: url:motion.dev)\n",
        encoding="utf-8",
    )
    (inv_dir / "practices.md").write_text(
        "- [practice] Declare what to preserve — Explicit negative constraints in UI prompting\n",
        encoding="utf-8",
    )
    reindex_path(home, inv_dir / "ui-ux.md")
    reindex_path(home, inv_dir / "practices.md")

    # 2. Create card
    card = Card(
        schema=1,
        key="url:componentry.dev",
        title="Componentry",
        category="ui-ux",
        kind="ui_ref",
        tags=["tailwind", "react", "components", "webgl"],
        features=["Matrix rain", "Animated gradients"],
        added=date(2026, 10, 6),
        url="https://componentry.dev",
    )
    save_card(home, card, "Animated React and WebGL component library")

    # Query for animation -> should find Motion in installed and Componentry in cards
    res = suggest_items(home, "react animation")
    assert res.found is True
    assert any(item.name == "Motion" for item in res.installed)

    # Query for tailwind components -> should find Componentry in cards
    res_card = suggest_items(home, "tailwind components")
    assert res_card.found is True
    assert any(c.title == "Componentry" for c in res_card.cards)

    # Query for negative constraints / prompting -> should find in practices
    res_practice = suggest_items(home, "negative constraints UI")
    assert res_practice.found is True
    assert any("preserve" in p.name.lower() for p in res_practice.practices)

    # Query for unrelated topic -> should cleanly return found: False and empty lists
    res_empty = suggest_items(home, "kubernetes cluster helm deployment")
    assert res_empty.found is False
    assert len(res_empty.installed) == 0
    assert len(res_empty.cards) == 0
    assert len(res_empty.practices) == 0

    # Query with only stop words
    res_stopwords = suggest_items(home, "the with and for")
    assert res_stopwords.found is False

    # Category filter
    res_cat = suggest_items(home, "components", category="repos-tools")
    assert len(res_cat.cards) == 0
    res_cat_ok = suggest_items(home, "components", category="ui-ux")
    assert len(res_cat_ok.cards) > 0
