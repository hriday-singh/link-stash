from pathlib import Path

import pytest

from stash.config import load_config
from stash.errors import Invalid


def test_explicit_home_wins_over_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("STASH_HOME", str(tmp_path / "env"))
    assert load_config(tmp_path / "arg").home == (tmp_path / "arg").resolve()


def test_env_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("STASH_HOME", str(tmp_path))
    assert load_config().home == tmp_path.resolve()


def test_default_home_is_user_stash(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("STASH_HOME", raising=False)
    assert load_config().home == (Path.home() / "stash").resolve()


def test_missing_config_gives_defaults(tmp_path: Path) -> None:
    config = load_config(tmp_path / "does-not-exist")
    assert config.port == 8765
    assert config.category_colors == {}
    assert config.web_dist is None


def test_values_from_toml_and_unknown_keys_ignored(tmp_path: Path) -> None:
    (tmp_path / "config.toml").write_text(
        'port = 9000\nreel_engines = ["agy"]\n\n[category_colors]\nmodels = "cat-extra-2"\n',
        encoding="utf-8",
    )
    config = load_config(tmp_path)
    assert config.port == 9000
    assert config.category_colors == {"models": "cat-extra-2"}


@pytest.mark.parametrize(
    "text",
    [
        "port = ",  # syntax error
        'port = "high"',  # wrong type
        "port = 70000",  # out of range
        "category_colors = 3",  # wrong type
    ],
)
def test_bad_config_raises_invalid_with_path(tmp_path: Path, text: str) -> None:
    (tmp_path / "config.toml").write_text(text, encoding="utf-8")
    with pytest.raises(Invalid) as info:
        load_config(tmp_path)
    assert info.value.code == "invalid"
    assert info.value.details["path"] == str(tmp_path.resolve() / "config.toml")


def test_reel_engines_and_whisper_defaults(tmp_path: Path) -> None:
    cfg = load_config(tmp_path)
    assert cfg.reel_engines == ["agy", "gemini_api", "frames"]
    assert cfg.whisper is False


def test_unknown_reel_engine_rejected(tmp_path: Path) -> None:
    (tmp_path / "config.toml").write_text('reel_engines = ["vlc"]\n', encoding="utf-8")
    with pytest.raises(Invalid):
        load_config(tmp_path)
