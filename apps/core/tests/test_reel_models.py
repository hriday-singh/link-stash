import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from stash.reel.models import ReelCta, ReelMention, ReelRecord


def test_reel_schema_file_exists():
    schema_path = Path(__file__).parent.parent / "src" / "stash" / "reel" / "schemas" / "reel.json"
    assert schema_path.is_file()
    data = json.loads(schema_path.read_text(encoding="utf-8"))
    assert data["title"] == "ReelRecord"
    assert "mentions" in data["properties"]


def test_reel_prompt_file_exists():
    prompt_path = Path(__file__).parent.parent / "src" / "stash" / "reel" / "prompt.md"
    assert prompt_path.is_file()
    text = prompt_path.read_text(encoding="utf-8")
    assert "Mentions" in text
    assert "Features" in text
    assert "Takeaways" in text


def test_valid_reel_record():
    record = ReelRecord(
        summary="A short demonstration of gh-secure for repository protection.",
        spoken_language="en",
        transcript=None,
        transcript_source="none",
        on_screen_text=["Protect your repo with one command", "$ gh secure status"],
        mentions=[
            ReelMention(
                kind="tool",
                name="gh-secure",
                url="https://gh.io/gh-secure",
                url_source="on_screen",
                evidence="on_screen",
                at="00:05",
            ),
            ReelMention(
                kind="repo",
                name="GitHubSecurityLab/gh-secure",
                url="https://github.com/GitHubSecurityLab/gh-secure",
                url_source="inferred",
                evidence="on_screen",
            ),
        ],
        features={"gh-secure": ["branch protection", "secret scanning", "Dependabot"]},
        takeaways=["Enables all five protections in one command"],
        cta=ReelCta(type="comment", keyword="SECURE", what_you_get="Direct link"),
        engine="agy-headless",
        confidence="high",
    )

    assert record.engine == "agy-headless"
    assert len(record.mentions) == 2
    assert record.mentions[0].kind == "tool"
    assert record.mentions[1].url_source == "inferred"
    assert record.features["gh-secure"] == ["branch protection", "secret scanning", "Dependabot"]
    assert record.cta is not None
    assert record.cta.keyword == "SECURE"


def test_invalid_mention_kind():
    with pytest.raises(ValidationError):
        ReelRecord(
            summary="test",
            transcript_source="none",
            mentions=[
                # Invalid kind "random_thing"
                ReelMention(kind="random_thing", name="something"),  # type: ignore
            ],
            engine="agy-headless",
        )


def test_extra_fields_forbidden():
    with pytest.raises(ValidationError):
        ReelRecord(
            summary="test",
            transcript_source="none",
            engine="agy-headless",
            extra_unallowed_field="bad",  # type: ignore
        )


def test_round1_fixture_compatibility():
    # Verify that the test outputs from Oct 5 can be validated as ReelRecords
    fixture_path = Path(__file__).parent.parent.parent.parent / "results-agy-round1.json"
    if not fixture_path.is_file():
        pytest.skip("results-agy-round1.json not present at repo root")

    data = json.loads(fixture_path.read_text(encoding="utf-8"))
    for item in data:
        mentions = [
            ReelMention(
                kind=m["kind"],
                name=m["name"],
                url=m.get("url"),
                evidence=m.get("evidence", "on_screen"),
                at=m.get("at"),
            )
            for m in item.get("mentions", [])
        ]
        record = ReelRecord(
            summary=item["summary"],
            spoken_language=item.get("spoken_language"),
            transcript=item.get("transcript"),
            transcript_source="none",
            on_screen_text=item.get("on_screen_text", []),
            mentions=mentions,
            features={},
            takeaways=[],
            engine="agy-host",
            confidence="high",
        )
        assert record.summary is not None
