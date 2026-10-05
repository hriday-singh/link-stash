"""Live integration tests for reel engines using recorded Oct 5 sample reels."""

import json
from pathlib import Path

import pytest

from stash.reel.models import ReelRecord
from stash.services.reel import ingest_reel

REPO_ROOT = Path(__file__).parent.parent.parent.parent.parent.resolve()
ROUND1_RESULTS = REPO_ROOT / "results-agy-round1.json"


@pytest.mark.live
def test_live_oct5_reels_exist():
    """Verify that sample reels downloaded during Oct 5 test exist at repo root."""
    reels = ["reel1.mp4", "reel2.mp4", "reel3.mp4"]
    for reel_name in reels:
        reel_path = REPO_ROOT / reel_name
        assert reel_path.is_file(), f"Expected test reel {reel_name} at {reel_path}"
        assert reel_path.stat().st_size > 0


@pytest.mark.live
def test_live_round1_ground_truth_ingestion(tmp_path: Path):
    """Verify that all 3 ground truth outputs from round 1 ingest cleanly into source records."""
    if not ROUND1_RESULTS.is_file():
        pytest.skip(f"Ground truth file missing: {ROUND1_RESULTS}")

    data = json.loads(ROUND1_RESULTS.read_text(encoding="utf-8"))
    assert len(data) == 3

    for item in data:
        file_name = item["file"]
        shortcode = Path(file_name).stem
        source_dir = tmp_path / "library" / "sources" / shortcode
        source_dir.mkdir(parents=True, exist_ok=True)

        # Place video and stub source.md
        video_source = REPO_ROOT / file_name
        if video_source.is_file():
            (source_dir / "video.mp4").write_bytes(video_source.read_bytes()[:1024])

        (source_dir / "source.md").write_text(
            f"---\nstage: fetched\ncreator: @test\n---\nCaption for {file_name}",
            encoding="utf-8",
        )

        record_json = json.dumps(
            {
                "summary": item["summary"],
                "transcript": item.get("transcript"),
                "transcript_source": "audio" if item.get("transcript") else "none",
                "on_screen_text": item.get("on_screen_text", []),
                "mentions": item.get("mentions", []),
                "features": {},
                "takeaways": [],
                "engine": "agy-host",
                "confidence": "high",
            }
        )

        record = ingest_reel(tmp_path, shortcode, record_json)
        assert isinstance(record, ReelRecord)
        assert record.engine == "agy-host"
        assert (source_dir / "raw.json").is_file()
        assert "stage: analyzed" in (source_dir / "source.md").read_text(encoding="utf-8")
