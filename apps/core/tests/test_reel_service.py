import json
from pathlib import Path
from unittest.mock import patch

import pytest

from stash.errors import NotFound, StashError
from stash.reel.agy import ReelEngineError
from stash.reel.models import ReelRecord
from stash.services.reel import analyze_reel, ingest_reel


def make_dummy_record(summary: str = "Test", engine: str = "agy-headless") -> ReelRecord:
    return ReelRecord(
        summary=summary,
        transcript_source="none",
        on_screen_text=[],
        mentions=[],
        features={},
        takeaways=[],
        engine=engine,  # type: ignore
        confidence="high",
    )


def test_missing_source_dir(tmp_path: Path):
    with pytest.raises(NotFound) as exc_info:
        analyze_reel(tmp_path, "missing_source")
    assert "Source directory not found" in str(exc_info.value)


def test_missing_video_file(tmp_path: Path):
    source_dir = tmp_path / "library" / "sources" / "test_src"
    source_dir.mkdir(parents=True)
    with pytest.raises(NotFound) as exc_info:
        analyze_reel(tmp_path, "test_src")
    assert "video.mp4 not found" in str(exc_info.value)


def test_cache_hit_bypasses_engines(tmp_path: Path):
    source_dir = tmp_path / "library" / "sources" / "cached_src"
    source_dir.mkdir(parents=True)
    video = source_dir / "video.mp4"
    video.write_bytes(b"video bytes")

    cached_record = make_dummy_record(summary="Cached analysis result", engine="gemini-api")
    (source_dir / "raw.json").write_text(cached_record.model_dump_json(), encoding="utf-8")

    with patch("stash.services.reel.run_agy_headless") as mock_agy:
        result = analyze_reel(tmp_path, "cached_src")
        assert result.summary == "Cached analysis result"
        assert result.engine == "gemini-api"
        assert mock_agy.call_count == 0


def test_engine_fallback_chain(tmp_path: Path):
    source_dir = tmp_path / "library" / "sources" / "fallback_src"
    source_dir.mkdir(parents=True)
    (source_dir / "video.mp4").write_bytes(b"video bytes")
    (source_dir / "source.md").write_text(
        "---\ncreator: @testdev\n---\nGreat reel", encoding="utf-8"
    )

    gemini_result = make_dummy_record(summary="Gemini took over", engine="gemini-api")

    with (
        patch("stash.services.reel.run_agy_headless", side_effect=ReelEngineError("agy timeout")),
        patch("stash.services.reel.run_gemini_api", return_value=gemini_result) as mock_gemini,
    ):
        record = analyze_reel(tmp_path, "fallback_src")
        assert record.summary == "Gemini took over"
        assert record.engine == "gemini-api"
        assert mock_gemini.call_count == 1
        assert (source_dir / "raw.json").is_file()


def test_all_engines_fail(tmp_path: Path):
    source_dir = tmp_path / "library" / "sources" / "all_fail"
    source_dir.mkdir(parents=True)
    (source_dir / "video.mp4").write_bytes(b"video bytes")

    with (
        patch("stash.services.reel.run_agy_headless", side_effect=ReelEngineError("agy failed")),
        patch("stash.services.reel.run_gemini_api", side_effect=ReelEngineError("gemini failed")),
        patch(
            "stash.services.reel.generate_contact_sheet",
            side_effect=ReelEngineError("ffmpeg failed"),
        ),
    ):
        with pytest.raises(ReelEngineError) as exc_info:
            analyze_reel(tmp_path, "all_fail")
        assert "All reel engines failed" in str(exc_info.value)


def test_ingest_reel_success(tmp_path: Path):
    source_dir = tmp_path / "library" / "sources" / "ingest_src"
    source_dir.mkdir(parents=True)
    (source_dir / "source.md").write_text(
        "---\nstage: fetched\n---\nCaption text", encoding="utf-8"
    )

    raw_json = json.dumps(
        {
            "summary": "Manual ingestion from agy in-session.",
            "transcript_source": "none",
            "on_screen_text": [],
            "mentions": [],
            "features": {},
            "takeaways": [],
            "confidence": "high",
        }
    )

    record = ingest_reel(tmp_path, "ingest_src", raw_json)
    assert record.summary == "Manual ingestion from agy in-session."
    assert record.engine == "agy-host"
    assert (source_dir / "raw.json").is_file()
    assert "stage: analyzed" in (source_dir / "source.md").read_text(encoding="utf-8")


def test_ingest_reel_invalid_json(tmp_path: Path):
    source_dir = tmp_path / "library" / "sources" / "invalid_json_src"
    source_dir.mkdir(parents=True)

    with pytest.raises(StashError) as exc_info:
        ingest_reel(tmp_path, "invalid_json_src", "not valid json")
    assert exc_info.value.code == "invalid_json"
