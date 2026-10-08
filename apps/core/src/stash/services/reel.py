"""Reel analysis service: engine orchestration, caching, and manual ingestion."""

import json
from pathlib import Path
from typing import Any, cast

from stash.errors import NotFound, StashError
from stash.reel.agy import ReelEngineError, run_agy_headless
from stash.reel.frames import generate_contact_sheet
from stash.reel.gemini_api import run_gemini_api
from stash.reel.models import ReelRecord
from stash.reel.whisper import transcribe
from stash.store.keys import source_dir as source_dir_for_key

DEFAULT_ENGINES: list[str] = ["agy", "gemini_api", "frames"]


def resolve_source_dir(home: Path, source_id: str) -> Path:
    """Finds the source directory under home/library/sources/.

    Accepts the key (`ig:ABC`), the directory name (`ig-ABC`) or a bare shortcode (`ABC`).
    """
    candidates = [source_dir_for_key(home, source_id), source_dir_for_key(home, f"ig:{source_id}")]
    for c in candidates:
        if c.is_dir():
            return c
    # Return standard path even if not yet created
    return candidates[0]


def read_source_metadata(source_dir: Path) -> tuple[str | None, str | None]:
    """Reads (caption, creator) from source.md if available."""
    source_md = source_dir / "source.md"
    if not source_md.is_file():
        return None, None

    text = source_md.read_text(encoding="utf-8")
    caption: str | None = None
    creator: str | None = None

    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            for line in parts[1].splitlines():
                stripped = line.strip()
                if stripped.startswith("creator:"):
                    val = stripped.split(":", 1)[1].strip().strip('"').strip("'")
                    if val and val != "null":
                        creator = val
            body = parts[2].strip()
            if body:
                caption = body

    return caption, creator


def update_source_stage_analyzed(source_dir: Path, record: ReelRecord) -> None:
    """Updates source.md frontmatter stage to 'analyzed' and sets engine."""
    source_md = source_dir / "source.md"
    if not source_md.is_file():
        return

    text = source_md.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return

    parts = text.split("---", 2)
    if len(parts) < 3:
        return

    fm_lines = [line for line in parts[1].strip().splitlines() if line.strip()]
    new_fm_lines: list[str] = []
    has_stage = False
    has_engine = False

    for line in fm_lines:
        stripped = line.strip()
        if stripped.startswith("stage:"):
            new_fm_lines.append("stage: analyzed")
            has_stage = True
        elif stripped.startswith("engine:"):
            new_fm_lines.append(f"engine: {record.engine}")
            has_engine = True
        else:
            new_fm_lines.append(line)

    if not has_stage:
        new_fm_lines.append("stage: analyzed")
    if not has_engine:
        new_fm_lines.append(f"engine: {record.engine}")

    new_content = f"---\n{'\n'.join(new_fm_lines)}\n---\n{parts[2].lstrip('\n')}"
    source_md.write_text(new_content, encoding="utf-8")


def analyze_reel(
    home: Path,
    source_id: str,
    engine: str | None = None,
    engines_order: list[str] | None = None,
    gemini_client: Any = None,
    whisper: bool = False,
) -> ReelRecord:
    """Orchestrates reel analysis: checks cache, executes engine chain, and persists raw.json.

    The frames engine is a handoff, not a result: it writes contact.jpg (+ transcript.json when
    `whisper`) for the host agent to read, and is never cached, so `stash ingest` fills it in.
    """
    source_dir = resolve_source_dir(home, source_id)
    if not source_dir.is_dir():
        raise NotFound(
            f"Source directory not found for id: {source_id}",
            {"source_id": source_id, "path": str(source_dir)},
        )

    # 1. Caching: If raw.json exists and is valid, return immediately
    raw_json_path = source_dir / "raw.json"
    if raw_json_path.is_file():
        try:
            cached_data: object = json.loads(raw_json_path.read_text(encoding="utf-8"))
            if isinstance(cached_data, dict):
                return ReelRecord.model_validate(cached_data)
        except Exception:
            # Corrupted cache; re-run analysis
            pass

    video_path = source_dir / "video.mp4"
    if not video_path.is_file():
        raise NotFound(
            f"video.mp4 not found in source directory: {source_dir}",
            {"source_id": source_id, "video_path": str(video_path)},
        )

    caption, creator = read_source_metadata(source_dir)
    chain = [engine] if engine else (engines_order or DEFAULT_ENGINES)
    errors: list[dict[str, object]] = []

    record: ReelRecord | None = None

    for eng in chain:
        try:
            if eng == "agy":
                record = run_agy_headless(source_dir=source_dir)
                break
            elif eng == "gemini_api":
                record = run_gemini_api(
                    video_path=video_path,
                    caption=caption,
                    creator=creator,
                    client=gemini_client,
                )
                break
            elif eng == "frames":
                generate_contact_sheet(
                    video_path=video_path, output_path=source_dir / "contact.jpg"
                )
                # ponytail: whisper always runs when enabled; "skip if the caption already
                # carries the speech" needs the on-screen text, which only the agent sees.
                cache = source_dir / "transcript.json"
                heard = transcribe(video_path, cache) if whisper else None
                record = ReelRecord(
                    summary="Frames fallback: read contact.jpg with the caption, fill the schema, "
                    f"pipe it to `stash ingest {source_id} -`.",
                    transcript=heard[0] if heard else None,
                    spoken_language=heard[1] if heard else None,
                    transcript_source="audio" if heard else "none",
                    engine="frames",
                    confidence="low",
                )
                break
            else:
                raise StashError("invalid_engine", f"Unknown reel engine: {eng}")
        except Exception as e:
            errors.append({"engine": eng, "error": str(e)})
            continue

    if record is None:
        raise ReelEngineError(
            f"All reel engines failed for source: {source_id}",
            {"source_id": source_id, "errors": errors},
        )

    if record.engine == "frames":
        return record

    # Persist raw.json and update source.md
    raw_json_path.write_text(record.model_dump_json(indent=2), encoding="utf-8")
    update_source_stage_analyzed(source_dir, record)

    return record


def ingest_reel(home: Path, source_id: str, raw_json_text: str) -> ReelRecord:
    """Ingests engine output directly (used when Antigravity inspects video in-session)."""
    source_dir = resolve_source_dir(home, source_id)
    if not source_dir.is_dir():
        raise NotFound(
            f"Source directory not found for id: {source_id}",
            {"source_id": source_id, "path": str(source_dir)},
        )

    try:
        parsed: object = json.loads(raw_json_text)
    except json.JSONDecodeError as e:
        raise StashError("invalid_json", f"Invalid JSON provided to ingest: {e}") from e

    if not isinstance(parsed, dict):
        raise StashError("invalid_json", "Ingested JSON must be an object")

    parsed_dict = cast(dict[str, Any], parsed)
    # Default to agy-host if not specified
    if "engine" not in parsed_dict:
        parsed_dict["engine"] = "agy-host"

    try:
        record = ReelRecord.model_validate(parsed_dict)
    except Exception as e:
        raise StashError(
            "schema_validation_error", f"ReelRecord schema validation failed: {e}"
        ) from e

    raw_json_path = source_dir / "raw.json"
    raw_json_path.write_text(record.model_dump_json(indent=2), encoding="utf-8")
    update_source_stage_analyzed(source_dir, record)

    return record
