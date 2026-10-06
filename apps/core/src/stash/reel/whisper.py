"""Optional speech transcript for the frames fallback (faster-whisper, CPU int8).

Off by default: install with `uv sync --extra whisper` and set `whisper = true` in config.toml
(`/stash-init` offers this). Without the package, transcribe() returns None.
"""

import importlib
import json
from pathlib import Path
from typing import Any

MODEL = "small"


def transcribe(video: Path, cache: Path) -> tuple[str, str | None] | None:
    """(text, language) of the speech in video, cached in `cache`. None if silent or unavailable."""
    if cache.is_file():
        data = json.loads(cache.read_text("utf-8"))
        return (data["text"], data.get("language")) if data.get("text") else None
    try:
        fw: Any = importlib.import_module("faster_whisper")
    except ImportError:
        return None
    model = fw.WhisperModel(MODEL, device="cpu", compute_type="int8")
    segments, info = model.transcribe(str(video), vad_filter=True)
    text = " ".join(s.text.strip() for s in segments).strip()
    language: str | None = info.language
    cache.write_text(json.dumps({"text": text, "language": language}), "utf-8")
    return (text, language) if text else None
