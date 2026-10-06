"""Read-only inventory scanners. Each reads one tool's files under the user's home and never
writes there. A scanner returns None when the tool is not installed."""

import json
import os
import tomllib
from collections.abc import Callable
from pathlib import Path
from typing import cast

import yaml

Item = tuple[str, str, str | None]  # (kind, name, key)
Scanner = Callable[[Path], list[Item] | None]

OTHER_TOOLS = (".claude-mem", ".mem0", ".impeccable", ".caveman", ".omniroute")
_RUNNERS = {"npx", "uvx", "bunx", "pipx", "dlx"}


def _obj(x: object) -> dict[str, object]:
    return cast(dict[str, object], x) if isinstance(x, dict) else {}


def _json(path: Path) -> dict[str, object]:
    try:
        return _obj(json.loads(path.read_text(encoding="utf-8")))
    except OSError, ValueError:
        return {}


def _skill_name(skill_md: Path) -> str:
    text = skill_md.read_text(encoding="utf-8", errors="replace")
    if text.startswith("---"):
        try:
            name = _obj(yaml.safe_load(text.split("---", 2)[1])).get("name")
            if isinstance(name, str) and name.strip():
                return name.strip()
        except yaml.YAMLError, IndexError:
            pass
    return skill_md.parent.name


def _skills(*dirs: Path) -> list[Item]:
    out: list[Item] = []
    for d in dirs:
        if d.is_dir():
            for md in sorted(d.glob("*/SKILL.md")):
                name = _skill_name(md)
                out.append(("skill", name, f"skill:{name.lower()}"))
    return out


def _subdirs(d: Path, kind: str, prefix: str) -> list[Item]:
    if not d.is_dir():
        return []
    return [
        (kind, p.name, f"{prefix}:{p.name.lower()}")
        for p in sorted(d.iterdir())
        if p.is_dir() and not p.name.startswith(".")
    ]


def mcp_package(cfg: dict[str, object]) -> str | None:
    """Package a stdio MCP server runs: `npx -y @scope/pkg@1` -> `@scope/pkg`."""
    args = cfg.get("args")
    tokens: list[str] = [str(cfg.get("command") or "")]
    if isinstance(args, list):
        tokens.extend(str(a) for a in cast(list[object], args))
    names = [Path(t).stem.lower() for t in tokens]
    for i, n in enumerate(names):
        if n in _RUNNERS:
            for t in tokens[i + 1 :]:
                if not t.startswith("-"):
                    pkg = t.split("==", 1)[0]
                    at = pkg.rfind("@")
                    return (pkg[:at] if at > 0 else pkg).lower()
    return None


def _mcp(servers: object) -> list[Item]:
    return [
        ("mcp", name, f"mcp:{mcp_package(_obj(cfg)) or name.lower()}")
        for name, cfg in sorted(_obj(servers).items())
    ]


def _dedup(items: list[Item]) -> list[Item]:
    seen: set[tuple[str, str]] = set()
    out: list[Item] = []
    for kind, name, key in items:
        token = (kind, name.lower())
        if token not in seen:
            seen.add(token)
            out.append((kind, name, key))
    return out


def claude_code(h: Path) -> list[Item] | None:
    root = h / ".claude"
    if not root.is_dir():
        return None
    items = _skills(root / "skills")
    plugins = _obj(_json(root / "plugins" / "installed_plugins.json").get("plugins"))
    for n, records in plugins.items():
        plugin_name = n.split("@")[0]
        items.append(("plugin", plugin_name, f"skill:{plugin_name.lower()}"))
        if isinstance(records, list):
            for rec in records:
                if isinstance(rec, dict):
                    ipath = rec.get("installPath")
                    if ipath and isinstance(ipath, str):
                        p_dir = Path(ipath)
                        if p_dir.is_dir():
                            items.extend(_skills(p_dir / "skills"))
    items += [("agent", p.stem, None) for p in sorted((root / "agents").glob("*.md"))]
    items += _mcp(_json(h / ".claude.json").get("mcpServers"))
    return _dedup(items)


def agent_skills(h: Path) -> list[Item] | None:
    dirs = [h / ".agents" / "skills", h / ".agent" / "skills"]
    return _dedup(_skills(*dirs)) if any(d.is_dir() for d in dirs) else None


def antigravity(h: Path) -> list[Item] | None:
    cli, cfg = h / ".gemini" / "antigravity-cli", h / ".gemini" / "config"
    if not (cli.is_dir() or cfg.is_dir()):
        return None
    items = _skills(cli / "skills", cfg / "skills", cli / "builtin" / "skills")
    for pd in (cli / "plugins", cfg / "plugins"):
        if pd.is_dir():
            for p in sorted(pd.iterdir()):
                if p.is_dir() and not p.name.startswith("."):
                    items.append(("plugin", p.name, f"skill:{p.name.lower()}"))
                    items.extend(_skills(p / "skills"))
    items += _mcp(_json(cfg / "mcp_config.json").get("mcpServers"))
    return _dedup(items)


def codex(h: Path) -> list[Item] | None:
    root = h / ".codex"
    if not root.is_dir():
        return None
    try:
        conf = tomllib.loads((root / "config.toml").read_text(encoding="utf-8"))
    except OSError, tomllib.TOMLDecodeError:
        conf = {}
    return _skills(root / "skills") + _mcp(conf.get("mcp_servers"))


def qwen(h: Path) -> list[Item] | None:
    root = h / ".qwen"
    return _mcp(_json(root / "settings.json").get("mcpServers")) if root.is_dir() else None


def other_tools(h: Path) -> list[Item] | None:
    # ponytail: presence only (Trae included); read their configs when one matters
    found = [d.lstrip(".") for d in (*OTHER_TOOLS, ".trae") if (h / d).is_dir()]
    return [("tool", n, None) for n in found] or None


def ollama(h: Path) -> list[Item] | None:
    """Manifests are `<registry>/<namespace>/<model>/<tag>`; `library` is the default namespace.

    ponytail: reads manifests instead of `ollama list`, which needs the server running.
    """
    env = os.environ.get("OLLAMA_MODELS")
    manifests = (Path(env) if env else h / ".ollama" / "models") / "manifests"
    if not manifests.is_dir():
        return None
    items: list[Item] = []
    for f in sorted(manifests.glob("*/*/*/*")):
        if f.is_file():
            registry, ns, model, tag = f.relative_to(manifests).parts
            name = "/".join(
                [
                    *([registry] if registry != "registry.ollama.ai" else []),
                    *([ns] if ns != "library" else []),
                    model,
                ]
            )
            items.append(("model", f"{name}:{tag}", f"ollama:{name.lower()}:{tag.lower()}"))
    return items


def lmstudio(h: Path) -> list[Item] | None:
    """ponytail: reads `<publisher>/<repo>/` dirs instead of `lms ls`; same data, no CLI."""
    roots = [h / ".lmstudio" / "models", h / ".cache" / "lm-studio" / "models"]
    if not any(r.is_dir() for r in roots):
        return None
    return [
        ("model", f"{p.parent.name}/{p.name}", f"lmstudio:{p.parent.name}/{p.name}".lower())
        for r in roots
        if r.is_dir()
        for p in sorted(r.glob("*/*"))
        if p.is_dir()
    ]


def huggingface(h: Path) -> list[Item] | None:
    hub = os.environ.get("HF_HUB_CACHE")
    hf_home = os.environ.get("HF_HOME")
    root = (
        Path(hub) if hub else (Path(hf_home) if hf_home else h / ".cache" / "huggingface") / "hub"
    )
    if not root.is_dir():
        return None
    items: list[Item] = []
    for p in sorted(root.iterdir()):
        prefix, _, rest = p.name.partition("--")
        hf_type = {"models": "model", "datasets": "dataset", "spaces": "space"}.get(prefix)
        if p.is_dir() and hf_type and rest:
            name = rest.replace("--", "/")
            items.append(
                ("model" if hf_type == "model" else hf_type, name, f"hf:{hf_type}:{name.lower()}")
            )
    return items


SCANNERS: dict[str, Scanner] = {
    "claude": claude_code,
    "agents": agent_skills,
    "antigravity": antigravity,
    "codex": codex,
    "qwen": qwen,
    "tools": other_tools,
    "ollama": ollama,
    "lmstudio": lmstudio,
    "huggingface": huggingface,
}
