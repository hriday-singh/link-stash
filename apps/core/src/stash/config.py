"""Loads STASH_HOME/config.toml. Keys not modelled yet are ignored until a milestone needs them."""

import os
import tomllib
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

from stash.errors import Invalid


class Config(BaseModel):
    home: Path
    port: int = Field(default=8765, ge=1, le=65535)
    category_colors: dict[str, str] = Field(default_factory=dict)
    web_dist: Path | None = None
    reel_engines: list[Literal["agy", "gemini_api", "frames"]] = Field(
        default_factory=lambda: ["agy", "gemini_api", "frames"], min_length=1
    )
    whisper: bool = False


def resolve_home(home: Path | None = None) -> Path:
    if home is None:
        env = os.environ.get("STASH_HOME")
        home = Path(env) if env else Path("~/stash")
    return home.expanduser().resolve()


def load_config(home: Path | None = None) -> Config:
    home = resolve_home(home)
    path = home / "config.toml"
    data: dict[str, object] = {}
    if path.is_file():
        try:
            data = tomllib.loads(path.read_text(encoding="utf-8"))
        except tomllib.TOMLDecodeError as e:
            raise Invalid(f"config.toml is not valid TOML: {e}", {"path": str(path)}) from e
    try:
        return Config.model_validate({**data, "home": home})
    except ValidationError as e:
        errors = [f"{'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors()]
        raise Invalid(
            "config.toml has invalid values", {"path": str(path), "errors": errors}
        ) from e
