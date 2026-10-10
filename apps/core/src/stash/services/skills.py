"""`stash install-skills`: Links or copies skills into Claude Code and Antigravity directories."""

import os
import platform
import shutil
import stat
import subprocess
from pathlib import Path
from typing import Literal

from stash.errors import Invalid

SKILL_NAMES = (
    "stash",
    "stash-init",
    "stash-have",
    "stash-pending",
    "stash-scan",
    "stash-suggest",
    "stash-feedback",
)


SkillInstallMode = Literal["copy", "symlink"]


def find_project_root(start: Path | None = None) -> Path:
    """Find the root of the project by traversing up for .git, .agents, or pnpm-workspace.yaml."""
    curr = (start or Path.cwd()).resolve()
    for p in [curr, *curr.parents]:
        if (
            (p / ".git").exists()
            or (p / ".agents").is_dir()
            or (p / "pnpm-workspace.yaml").is_file()
        ):
            return p
    return curr


def get_default_targets(
    user_home: Path | None = None,
    workspace: bool = False,
    workspace_dir: Path | None = None,
) -> list[Path]:
    """Return target skill directories for Claude Code, Antigravity, and optional workspace."""
    h = user_home or Path.home()
    targets = [
        h / ".claude" / "skills",
        h / ".gemini" / "antigravity-cli" / "skills",
        h / ".gemini" / "config" / "skills",
    ]
    if workspace:
        root = workspace_dir or find_project_root()
        targets.append(root / ".agents" / "skills")
    return targets


def is_junction_or_symlink(path: Path) -> bool:
    """Check whether a path is a symbolic link or a Windows directory junction."""
    if path.is_symlink():
        return True
    try:
        st = os.lstat(path)
        reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
        attrs = getattr(st, "st_file_attributes", 0)
        if attrs & reparse_flag:
            return True
    except OSError:
        pass
    return False


def remove_target(target: Path) -> None:
    """Safely remove an existing directory, junction, symlink, or file."""
    if is_junction_or_symlink(target):
        try:
            target.unlink()
            return
        except OSError:
            try:
                os.rmdir(target)
                return
            except OSError:
                pass

    if not target.exists():
        return

    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()


def copy_dir(source: Path, target: Path) -> bool:
    """Copy a directory tree cleanly, replacing any existing target."""
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        remove_target(target)
        shutil.copytree(source, target)
        return True
    except Exception:
        return False


def link_dir(source: Path, target: Path) -> bool:
    """Create directory junction on Windows or symlink on Unix, replacing any existing target."""
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        remove_target(target)
        if platform.system() == "Windows":
            try:
                cmd = f'cmd /c mklink /J "{target}" "{source}"'
                res = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=False)
                if res.returncode == 0:
                    return True
            except Exception:
                pass

            try:
                os.symlink(str(source), str(target), target_is_directory=True)
                return True
            except Exception:
                return False
        else:
            try:
                os.symlink(str(source), str(target), target_is_directory=True)
                return True
            except Exception:
                return False
    except Exception:
        return False


def install_skills(
    skills_dir: Path,
    targets: list[Path] | None = None,
    user_home: Path | None = None,
    mode: SkillInstallMode = "copy",
    workspace: bool = False,
    workspace_dir: Path | None = None,
) -> dict[str, list[str]]:
    """Install each skill folder in skills_dir into target agent directories.

    - mode 'copy': copies full skill folder (universal discovery across all OSes and tools).
    - mode 'symlink': creates directory junction on Windows or symlink on Unix.
    - workspace: also installs into <root>/.agents/skills for project-level discovery.

    Returns dict mapping target path string to list of installed skill names.
    """
    if mode not in ("copy", "symlink"):
        raise Invalid(f"invalid install mode: {mode!r}, expected 'copy' or 'symlink'")

    dest_dirs = targets or get_default_targets(
        user_home=user_home,
        workspace=workspace,
        workspace_dir=workspace_dir,
    )
    result: dict[str, list[str]] = {}

    for dest in dest_dirs:
        linked: list[str] = []
        for skill_name in SKILL_NAMES:
            skill_src = skills_dir / skill_name
            if not skill_src.is_dir():
                continue
            skill_dst = dest / skill_name
            installer = copy_dir if mode == "copy" else link_dir
            if installer(skill_src, skill_dst):
                linked.append(skill_name)
        result[str(dest)] = linked

    return result
