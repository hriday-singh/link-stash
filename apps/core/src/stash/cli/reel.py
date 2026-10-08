"""CLI subcommands for reel analysis: `stash analyze` and `stash ingest`."""

import json
import sys
from pathlib import Path
from typing import NoReturn

import typer

from stash.config import load_config
from stash.errors import StashError
from stash.services.reel import analyze_reel, ingest_reel, resolve_source_dir

# Minimal valid ReelRecord for `stash ingest`; full schema in stash/reel/schemas/reel.json.
INGEST_TEMPLATE: dict[str, object] = {
    "summary": "One line on what the post shows.",
    "on_screen_text": [],
    "mentions": [
        {"kind": "repo", "name": "owner/repo", "url": "https://github.com/owner/repo",
         "url_source": "on_screen", "evidence": "on_screen"},
    ],
    "takeaways": [],
    "cta": {"type": "none"},
    "engine": "agy-host",
    "confidence": "medium",
}  # fmt: skip


def _print(data: object) -> None:
    typer.echo(json.dumps(data, indent=2, default=str))


def _fail(err: StashError) -> NoReturn:
    typer.echo(json.dumps(err.to_dict(), default=str), err=True)
    raise typer.Exit(2)


def register_reel_commands(app: typer.Typer) -> None:
    @app.command("analyze")
    def analyze(
        source_id: str = typer.Argument(..., help="Source ID to analyze"),
        engine: str | None = typer.Option(
            None,
            "--engine",
            "-e",
            help="Specific reel engine to run: agy, gemini_api, or frames",
        ),
    ) -> None:
        """Analyze a downloaded reel video using agy, Gemini API, or frames fallback."""
        try:
            cfg = load_config()
            record = analyze_reel(
                cfg.home,
                source_id,
                engine=engine,
                engines_order=list(cfg.reel_engines),
                whisper=cfg.whisper,
            )
            out = record.model_dump()
            if record.engine == "frames":
                sdir = resolve_source_dir(cfg.home, source_id)
                out["needs_agent"] = {
                    "contact": str(sdir / "contact.jpg"),
                    "caption": str(sdir / "source.md"),
                    "next": f"stash ingest {source_id} -  (optional; check/save do not need it)",
                    "template": INGEST_TEMPLATE,
                }
            _print(out)
        except StashError as e:
            _fail(e)

    @app.command("ingest")
    def ingest(
        source_id: str = typer.Argument("", help="Source ID to ingest into"),
        file: str = typer.Argument("-", help="Path to JSON file, or '-' to read from stdin"),
        template: bool = typer.Option(
            False, "--template", help="Print a minimal valid JSON to fill in, then exit."
        ),
    ) -> None:
        """Ingest raw structured reel JSON into sources/<id>/raw.json (from file or stdin)."""
        if template:
            _print(INGEST_TEMPLATE)
            return
        if not source_id:
            _fail(StashError("invalid", "source_id is required unless --template is given"))
        try:
            cfg = load_config()
            raw_json = sys.stdin.read() if file == "-" else Path(file).read_text(encoding="utf-8")

            record = ingest_reel(cfg.home, source_id, raw_json)
            _print(record.model_dump())
        except StashError as e:
            _fail(e)
        except OSError as e:
            typer.echo(
                json.dumps(
                    {
                        "error": {
                            "code": "file_read_error",
                            "message": f"Could not read input file {file}: {e}",
                            "details": {"file": file},
                        }
                    }
                ),
                err=True,
            )
            raise typer.Exit(1) from e
