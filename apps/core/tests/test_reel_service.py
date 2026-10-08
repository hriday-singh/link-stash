import json
from pathlib import Path
from unittest.mock import patch

import pytest

from stash.errors import NotFound, StashError
from stash.reel.agy import ReelEngineError
from stash.reel.models import ReelRecord
from stash.services.reel import analyze_reel, ingest_reel, resolve_source_dir


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


@pytest.mark.parametrize("given", ["ig:ABC", "ig-ABC", "ABC"])
def test_resolve_source_dir_accepts_key_dir_or_shortcode(tmp_path: Path, given: str):
    d = tmp_path / "library" / "sources" / "ig-ABC"
    d.mkdir(parents=True)
    assert resolve_source_dir(tmp_path, given) == d


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


# A9: frames fallback is a handoff to the host agent, never a cached result.


def _src(home: Path, sid: str = "ig-F1") -> Path:
    sdir = home / "library" / "sources" / sid
    sdir.mkdir(parents=True)
    (sdir / "video.mp4").write_bytes(b"video bytes")
    (sdir / "source.md").write_text("---\nstage: fetched\n---\nCaption", encoding="utf-8")
    return sdir


def _engines_down():
    return (
        patch("stash.services.reel.run_agy_headless", side_effect=ReelEngineError("agy down")),
        patch("stash.services.reel.run_gemini_api", side_effect=ReelEngineError("quota")),
        patch("stash.services.reel.generate_contact_sheet"),
    )


def test_frames_handoff_is_not_cached(tmp_path: Path):
    sdir = _src(tmp_path)
    agy, gem, sheet = _engines_down()
    with agy, gem, sheet, patch("stash.services.reel.transcribe") as tr:
        record = analyze_reel(tmp_path, "ig-F1")
        assert record.engine == "frames" and "stash ingest ig-F1 -" in record.summary
        tr.assert_not_called()  # whisper off by default
    assert not (sdir / "raw.json").exists()
    assert "stage: fetched" in (sdir / "source.md").read_text(encoding="utf-8")


def test_frames_with_whisper_carries_transcript(tmp_path: Path):
    _src(tmp_path)
    agy, gem, sheet = _engines_down()
    with agy, gem, sheet, patch("stash.services.reel.transcribe", return_value=("hola", "es")):
        record = analyze_reel(tmp_path, "ig-F1", whisper=True)
    assert record.transcript == "hola" and record.spoken_language == "es"
    assert record.transcript_source == "audio"


def test_agy_and_gemini_down_still_yields_a_card(tmp_path: Path):
    """A9 done criterion: frames handoff -> agent ingests -> card saved."""
    from stash.services.cards import save
    from stash.store.models import Card, SourceDoc
    from stash.store.sources import write_source

    sdir = _src(tmp_path)
    url = "https://www.instagram.com/reel/F1/"
    write_source(tmp_path, SourceDoc(key="ig:F1", platform="instagram", url=url, stage="fetched"))
    agy, gem, sheet = _engines_down()
    with agy, gem, sheet:
        assert analyze_reel(tmp_path, "ig-F1").engine == "frames"
    agent_json = json.dumps({"summary": "Shows the widget repo", "confidence": "medium"})
    ingest_reel(tmp_path, "ig-F1", agent_json)
    assert analyze_reel(tmp_path, "ig-F1").summary == "Shows the widget repo"  # cached now
    card = Card.model_validate(
        {
            "key": "github:acme/widget",
            "title": "Widget",
            "category": "repos-tools",
            "kind": "repo",
            "added": "2026-10-06",
            "sources": ["ig:F1"],
        }
    )
    result = save(tmp_path, card, "From a reel.")
    assert (tmp_path / result.path).is_file()
    assert (sdir / "raw.json").is_file()
