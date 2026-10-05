"""Headless Antigravity CLI (agy) reel analysis engine."""

import json
import shutil
import subprocess
from pathlib import Path
from typing import cast

from stash.errors import StashError
from stash.reel.models import ReelRecord

DEFAULT_PROMPT_PATH = Path(__file__).parent / "prompt.md"
DEFAULT_SCHEMA_PATH = Path(__file__).parent / "schemas" / "reel.json"


class ReelEngineError(StashError):
    """Raised when a reel analysis engine fails or times out."""

    def __init__(self, message: str, details: dict[str, object] | None = None):
        super().__init__("reel_engine_error", message, details)


def run_agy_headless(
    source_dir: Path,
    prompt_path: Path | None = None,
    schema_path: Path | None = None,
    timeout: int = 300,
) -> ReelRecord:
    """Runs `agy` in headless mode within `source_dir` and returns a validated `ReelRecord`."""
    agy_bin = shutil.which("agy")
    if not agy_bin:
        raise ReelEngineError(
            "agy executable not found on PATH",
            {"engine": "agy-headless", "source_dir": str(source_dir)},
        )

    resolved_prompt_path = (prompt_path or DEFAULT_PROMPT_PATH).resolve()
    resolved_schema_path = (schema_path or DEFAULT_SCHEMA_PATH).resolve()

    if not resolved_prompt_path.is_file():
        raise ReelEngineError(
            f"Prompt file not found: {resolved_prompt_path}",
            {"engine": "agy-headless", "prompt_path": str(resolved_prompt_path)},
        )
    if not resolved_schema_path.is_file():
        raise ReelEngineError(
            f"Schema file not found: {resolved_schema_path}",
            {"engine": "agy-headless", "schema_path": str(resolved_schema_path)},
        )

    prompt_text = resolved_prompt_path.read_text(encoding="utf-8")
    cmd = [
        agy_bin,
        "-p",
        prompt_text,
        "--output-format",
        "json",
        "--json-schema",
        str(resolved_schema_path),
        "--print-timeout",
        "5m",
    ]

    try:
        proc = subprocess.run(
            cmd,
            cwd=str(source_dir),
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
        )
    except subprocess.TimeoutExpired as e:
        raise ReelEngineError(
            f"agy execution timed out after {timeout} seconds",
            {"engine": "agy-headless", "timeout": timeout},
        ) from e
    except OSError as e:
        raise ReelEngineError(
            f"Failed to execute agy subprocess: {e}",
            {"engine": "agy-headless", "error": str(e)},
        ) from e

    if proc.returncode != 0:
        raise ReelEngineError(
            f"agy exited with code {proc.returncode}",
            {
                "engine": "agy-headless",
                "returncode": proc.returncode,
                "stderr": proc.stderr.strip(),
                "stdout": proc.stdout.strip(),
            },
        )

    try:
        raw_output: object = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise ReelEngineError(
            f"Failed to parse agy JSON output: {e}",
            {"engine": "agy-headless", "stdout": proc.stdout},
        ) from e

    if not isinstance(raw_output, dict):
        raise ReelEngineError(
            "agy output is not a JSON object",
            {"engine": "agy-headless", "stdout": proc.stdout},
        )

    raw_dict = cast(dict[str, object], raw_output)
    record_data: object = raw_dict.get("structured_output", raw_dict)

    try:
        record = ReelRecord.model_validate(record_data)
    except Exception as e:
        raise ReelEngineError(
            f"Schema validation failed on agy output: {e}",
            {"engine": "agy-headless", "error": str(e), "data": record_data},
        ) from e

    return record.model_copy(update={"engine": "agy-headless"})
