# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportMissingTypeStubs=false, reportAttributeAccessIssue=false
"""Gemini API reel analysis engine using google-genai."""

import json
import os
import time
from pathlib import Path
from typing import Any, cast

from stash.reel.agy import ReelEngineError
from stash.reel.models import ReelRecord

DEFAULT_PROMPT_PATH = Path(__file__).parent / "prompt.md"
DEFAULT_MODEL = "gemini-3.8-flash"
INLINE_SIZE_LIMIT_BYTES = 20 * 1024 * 1024  # 20 MB


def build_gemini_prompt(
    base_prompt: str,
    caption: str | None = None,
    creator: str | None = None,
) -> str:
    """Combines system rules with reel-specific metadata (author, caption)."""
    parts = [base_prompt.strip(), "\n## Reel Context\n"]
    if creator:
        parts.append(f"- Creator Handle: {creator}")
    if caption:
        parts.append(f"- Post Caption:\n```\n{caption.strip()}\n```")
    else:
        parts.append("- Post Caption: (None)")
    return "\n".join(parts)


def run_gemini_api(
    video_path: Path,
    caption: str | None = None,
    creator: str | None = None,
    prompt_path: Path | None = None,
    api_key: str | None = None,
    model: str = DEFAULT_MODEL,
    client: Any = None,
) -> ReelRecord:
    """Analyzes a reel video using Gemini API (inline for <20MB, Files API for >=20MB)."""
    if not video_path.is_file():
        raise ReelEngineError(
            f"Video file not found: {video_path}",
            {"engine": "gemini-api", "video_path": str(video_path)},
        )

    resolved_api_key = api_key or os.environ.get("GEMINI_API_KEY")
    if client is None and not resolved_api_key:
        raise ReelEngineError(
            "GEMINI_API_KEY environment variable missing",
            {"engine": "gemini-api"},
        )

    resolved_prompt_path = (prompt_path or DEFAULT_PROMPT_PATH).resolve()
    if not resolved_prompt_path.is_file():
        raise ReelEngineError(
            f"Prompt file not found: {resolved_prompt_path}",
            {"engine": "gemini-api", "prompt_path": str(resolved_prompt_path)},
        )

    base_prompt = resolved_prompt_path.read_text(encoding="utf-8")
    full_prompt = build_gemini_prompt(base_prompt, caption=caption, creator=creator)

    # Initialize client if not injected
    if client is None:
        try:
            from google import genai
        except ImportError as e:
            raise ReelEngineError(
                "google-genai package is not installed. Install via `uv add google-genai`",
                {"engine": "gemini-api"},
            ) from e
        client = genai.Client(api_key=resolved_api_key)

    file_size = video_path.stat().st_size

    try:
        from google.genai import types  # type: ignore[import-not-found]
    except ImportError:
        # Support running with mock client in unit tests when google-genai is not installed
        types = None  # type: ignore[assignment]

    contents: list[object] = []

    if file_size < INLINE_SIZE_LIMIT_BYTES:
        # Inline payload for videos under 20 MB
        video_bytes = video_path.read_bytes()
        if types is not None:
            part = types.Part.from_bytes(data=video_bytes, mime_type="video/mp4")
        else:
            part = {"inline_data": {"data": video_bytes, "mime_type": "video/mp4"}}
        contents.append(part)
    else:
        # Upload via Files API for videos 20 MB or larger
        uploaded_file = client.files.upload(file=str(video_path))
        # Wait until file processing completes if state attribute is present
        while getattr(uploaded_file, "state", None) and str(uploaded_file.state) == "PROCESSING":
            time.sleep(2)
            uploaded_file = client.files.get(name=uploaded_file.name)
        if getattr(uploaded_file, "state", None) and str(uploaded_file.state) == "FAILED":
            raise ReelEngineError(
                f"Gemini Files API processing failed for {video_path.name}",
                {"engine": "gemini-api", "file_name": uploaded_file.name},
            )
        contents.append(uploaded_file)

    contents.append(full_prompt)

    try:
        if types is not None:
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ReelRecord,
            )
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
        else:
            response = client.models.generate_content(
                model=model,
                contents=contents,
            )
    except Exception as e:
        raise ReelEngineError(
            f"Gemini API generate_content failed: {e}",
            {"engine": "gemini-api", "error": str(e)},
        ) from e

    response_text = getattr(response, "text", None) or ""
    try:
        raw_output: object = json.loads(response_text)
    except json.JSONDecodeError as e:
        raise ReelEngineError(
            f"Failed to parse Gemini response as JSON: {e}",
            {"engine": "gemini-api", "response_text": response_text},
        ) from e

    if not isinstance(raw_output, dict):
        raise ReelEngineError(
            "Gemini response JSON is not an object",
            {"engine": "gemini-api", "response_text": response_text},
        )

    raw_dict = cast(dict[str, object], raw_output)

    try:
        record = ReelRecord.model_validate(raw_dict)
    except Exception as e:
        raise ReelEngineError(
            f"Schema validation failed on Gemini output: {e}",
            {"engine": "gemini-api", "error": str(e), "data": raw_dict},
        ) from e

    return record.model_copy(update={"engine": "gemini-api"})
