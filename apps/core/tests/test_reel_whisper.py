"""Optional faster-whisper transcript: cached, and a no-op when the extra is not installed."""

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from stash.reel.whisper import transcribe


def test_missing_package_returns_none(tmp_path: Path) -> None:
    with patch("stash.reel.whisper.importlib.import_module", side_effect=ImportError):
        assert transcribe(tmp_path / "v.mp4", tmp_path / "t.json") is None
    assert not (tmp_path / "t.json").exists()


def test_transcribes_once_then_reads_cache(tmp_path: Path) -> None:
    calls: list[str] = []

    class Model:
        def __init__(self, *_: object, **__: object) -> None:
            pass

        def transcribe(self, path: str, **_: object) -> tuple[list[SimpleNamespace], object]:
            calls.append(path)
            segs = [SimpleNamespace(text=" hello "), SimpleNamespace(text="world")]
            return segs, SimpleNamespace(language="en")

    cache = tmp_path / "t.json"
    fake = SimpleNamespace(WhisperModel=Model)
    with patch("stash.reel.whisper.importlib.import_module", return_value=fake):
        assert transcribe(tmp_path / "v.mp4", cache) == ("hello world", "en")
        assert transcribe(tmp_path / "v.mp4", cache) == ("hello world", "en")
    assert len(calls) == 1
    assert json.loads(cache.read_text("utf-8"))["language"] == "en"


def test_silent_video_returns_none(tmp_path: Path) -> None:
    cache = tmp_path / "t.json"
    cache.write_text(json.dumps({"text": "", "language": None}), "utf-8")
    assert transcribe(tmp_path / "v.mp4", cache) is None
