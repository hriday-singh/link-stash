"""Unit tests for install_skills service."""

from pathlib import Path

from stash.services.skills import SKILL_NAMES, get_default_targets, install_skills


def test_get_default_targets(tmp_path: Path) -> None:
    targets = get_default_targets(tmp_path)
    assert len(targets) == 3
    paths_str = [str(t) for t in targets]
    assert any(".claude" in p for p in paths_str)
    assert any("antigravity-cli" in p for p in paths_str)
    assert any("config" in p for p in paths_str)


def test_install_skills(tmp_path: Path) -> None:
    skills_root = tmp_path / "skills"
    skills_root.mkdir()

    # Create dummy skill folders
    for name in SKILL_NAMES:
        s_dir = skills_root / name
        s_dir.mkdir()
        (s_dir / "SKILL.md").write_text(f"---\nname: {name}\n---\n", encoding="utf-8")

    dest_dir = tmp_path / "target_skills"
    res = install_skills(skills_root, targets=[dest_dir])

    assert str(dest_dir) in res
    assert len(res[str(dest_dir)]) == len(SKILL_NAMES)
    for name in SKILL_NAMES:
        assert (dest_dir / name).exists()
        assert (dest_dir / name / "SKILL.md").is_file()
