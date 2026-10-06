"""Unit tests for install_skills service."""

from pathlib import Path

import pytest

from stash.errors import Invalid
from stash.services.skills import (
    SKILL_NAMES,
    get_default_targets,
    install_skills,
    is_junction_or_symlink,
    remove_target,
)


def test_get_default_targets(tmp_path: Path) -> None:
    targets = get_default_targets(tmp_path)
    assert len(targets) == 3
    paths_str = [str(t) for t in targets]
    assert any(".claude" in p for p in paths_str)
    assert any("antigravity-cli" in p for p in paths_str)
    assert any("config" in p for p in paths_str)


def test_get_default_targets_workspace(tmp_path: Path) -> None:
    ws = tmp_path / "my_project"
    targets = get_default_targets(tmp_path, workspace=True, workspace_dir=ws)
    assert len(targets) == 4
    assert ws / ".agents" / "skills" in targets


def test_install_skills_copy_creates_real_directories(tmp_path: Path) -> None:
    skills_root = tmp_path / "skills"
    skills_root.mkdir()

    for name in SKILL_NAMES:
        s_dir = skills_root / name
        s_dir.mkdir()
        (s_dir / "SKILL.md").write_text(f"---\nname: {name}\n---\n", encoding="utf-8")

    dest_dir = tmp_path / "target_skills"
    res = install_skills(skills_root, targets=[dest_dir], mode="copy")

    assert str(dest_dir) in res
    assert len(res[str(dest_dir)]) == len(SKILL_NAMES)
    for name in SKILL_NAMES:
        skill_dst = dest_dir / name
        assert skill_dst.exists()
        assert skill_dst.is_dir()
        assert not skill_dst.is_symlink()
        assert not is_junction_or_symlink(skill_dst)
        assert (skill_dst / "SKILL.md").read_text("utf-8") == f"---\nname: {name}\n---\n"


def test_install_skills_replaces_existing_target(tmp_path: Path) -> None:
    skills_root = tmp_path / "skills"
    skills_root.mkdir()

    for name in SKILL_NAMES:
        s_dir = skills_root / name
        s_dir.mkdir()
        (s_dir / "SKILL.md").write_text(f"updated: {name}", encoding="utf-8")

    dest_dir = tmp_path / "target_skills"
    dest_dir.mkdir()
    # Pre-create a stale target directory
    stale_skill = dest_dir / "stash"
    stale_skill.mkdir()
    (stale_skill / "old.txt").write_text("stale", encoding="utf-8")

    res = install_skills(skills_root, targets=[dest_dir], mode="copy")
    assert "stash" in res[str(dest_dir)]
    assert not (stale_skill / "old.txt").exists()
    assert (stale_skill / "SKILL.md").read_text("utf-8") == "updated: stash"


def test_install_skills_symlink_mode(tmp_path: Path) -> None:
    skills_root = tmp_path / "skills"
    skills_root.mkdir()

    for name in SKILL_NAMES:
        s_dir = skills_root / name
        s_dir.mkdir()
        (s_dir / "SKILL.md").write_text("hello", encoding="utf-8")

    dest_dir = tmp_path / "symlink_skills"
    res = install_skills(skills_root, targets=[dest_dir], mode="symlink")
    assert str(dest_dir) in res
    assert len(res[str(dest_dir)]) == len(SKILL_NAMES)
    for name in SKILL_NAMES:
        assert (dest_dir / name / "SKILL.md").is_file()


def test_install_skills_invalid_mode(tmp_path: Path) -> None:
    skills_root = tmp_path / "skills"
    with pytest.raises(Invalid):
        # pyright: ignore[reportArgumentType]
        install_skills(skills_root, mode="unknown")  # type: ignore[arg-type]


def test_remove_target_handles_missing_and_existing(tmp_path: Path) -> None:
    non_existent = tmp_path / "does_not_exist"
    remove_target(non_existent)  # Should not raise

    real_dir = tmp_path / "some_dir"
    real_dir.mkdir()
    (real_dir / "file.txt").write_text("content", encoding="utf-8")
    remove_target(real_dir)
    assert not real_dir.exists()
