"""`stash install-skills`: Links skills into Claude Code and Antigravity directories."""

import os
import platform
import subprocess
from pathlib import Path

SKILL_NAMES = ("stash", "stash-init", "stash-have", "stash-pending", "stash-scan")


def get_default_targets(user_home: Path | None = None) -> list[Path]:
    h = user_home or Path.home()
    return [
        h / ".claude" / "skills",
        h / ".gemini" / "antigravity-cli" / "skills",
        h / ".gemini" / "config" / "skills",
    ]


def _link_dir(source: Path, target: Path) -> bool:
    """Create directory junction on Windows or symlink on Unix."""
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_symlink() or target.is_dir():
        # Check if already points to source
        try:
            if target.resolve() == source.resolve():
                return True
        except Exception:
            pass
        return True

    if platform.system() == "Windows":
        try:
            # Try native junction via subprocess mklink /J
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


def install_skills(
    skills_dir: Path,
    targets: list[Path] | None = None,
    user_home: Path | None = None,
) -> dict[str, list[str]]:
    """Link each skill folder in skills_dir into target agent directories.

    Returns dict mapping target path string to list of linked skill names.
    """
    dest_dirs = targets or get_default_targets(user_home)
    result: dict[str, list[str]] = {}

    for dest in dest_dirs:
        linked: list[str] = []
        for skill_name in SKILL_NAMES:
            skill_src = skills_dir / skill_name
            if not skill_src.is_dir():
                continue
            skill_dst = dest / skill_name
            if _link_dir(skill_src, skill_dst):
                linked.append(skill_name)
        result[str(dest)] = linked

    return result
