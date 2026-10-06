"""Unit tests for the inventory scanning and `have` services."""

from pathlib import Path

from stash.services.inventory import have, is_inventory_stale, scan_inventory
from stash.store.index import connect


def test_inventory_scan_and_index(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    fake_user_home = tmp_path / "user"
    fake_user_home.mkdir()

    # Create mock Claude skill
    skill_dir = fake_user_home / ".claude" / "skills" / "my-skill"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text("# My Skill", encoding="utf-8")

    # Create mock Ollama model
    ollama_dir = (
        fake_user_home
        / ".ollama"
        / "models"
        / "manifests"
        / "registry.ollama.ai"
        / "library"
        / "llama3"
    )
    ollama_dir.mkdir(parents=True)
    (ollama_dir / "8b").write_text("{}", encoding="utf-8")

    items = scan_inventory(home, force=True, user_home=fake_user_home)
    assert items is not None
    assert len(items) == 2

    # Check files created in inventory/auto/
    claude_md = home / "inventory" / "auto" / "claude.md"
    assert claude_md.is_file()
    assert "my-skill" in claude_md.read_text(encoding="utf-8")

    ollama_md = home / "inventory" / "auto" / "ollama.md"
    assert ollama_md.is_file()
    assert "llama3:8b" in ollama_md.read_text(encoding="utf-8")

    # Check SQLite index
    db = connect(home)
    rows = db.execute("SELECT * FROM inventory").fetchall()
    names = {r["name"] for r in rows}
    assert "my-skill" in names
    assert "llama3:8b" in names
    db.close()


def test_inventory_stale_detection(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()
    assert is_inventory_stale(home) is True


def test_have_command(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    entry = have(home, "https://github.com/astral-sh/uv")
    assert entry.key == "github:astral-sh/uv"
    assert entry.kind == "repo"
    assert entry.name == "astral-sh/uv"

    manual_file = home / "inventory" / "manual" / "tools.md"
    assert manual_file.is_file()
    assert "github:astral-sh/uv" in manual_file.read_text(encoding="utf-8")

    db = connect(home)
    row = db.execute("SELECT * FROM inventory WHERE key = 'github:astral-sh/uv'").fetchone()
    assert row is not None
    assert row["origin"] == "manual/tools.md"
    db.close()


def test_have_batch_command(tmp_path: Path) -> None:
    from stash.services.inventory import have_batch

    home = tmp_path / "stash"
    home.mkdir()

    items = [
        "[ui_ref] shadcn/ui — component kit https://ui.shadcn.com",
        "[practice] Plan before building",
        "[model] my-model https://huggingface.co/org/my-model",
        "https://github.com/astral-sh/uv",
    ]
    entries = have_batch(home, items)
    assert len(entries) == 4
    origins = {e.origin for e in entries}
    assert origins == {
        "manual/ui-ux.md",
        "manual/practices.md",
        "manual/models.md",
        "manual/tools.md",
    }

    db = connect(home)
    count = db.execute("SELECT count(*) FROM inventory WHERE origin LIKE 'manual/%'").fetchone()[0]
    assert count == 4
    db.close()


def test_antigravity_plugin_skills_scan(tmp_path: Path) -> None:
    from stash.scanners import antigravity

    user_home = tmp_path / "user"
    user_home.mkdir()

    # Create mock Antigravity config plugin with skills
    plugin_skill_dir = (
        user_home
        / ".gemini"
        / "config"
        / "plugins"
        / "superpowers"
        / "skills"
        / "brainstorming"
    )
    plugin_skill_dir.mkdir(parents=True)
    content = "---\nname: brainstorming\n---\n# Brainstorming"
    (plugin_skill_dir / "SKILL.md").write_text(content, encoding="utf-8")

    items = antigravity(user_home)
    assert items is not None
    names = {name for _, name, _ in items}
    assert "superpowers" in names  # plugin name
    assert "brainstorming" in names  # constituent skill name

