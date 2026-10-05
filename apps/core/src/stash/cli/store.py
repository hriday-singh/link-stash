"""Store-related CLI commands (reindex, etc.)."""

import json
from typing import NoReturn

import typer

from stash.config import load_config
from stash.errors import StashError
from stash.store.index import rebuild


def _print(data: object) -> None:
    typer.echo(json.dumps(data, indent=2, default=str))


def _fail(err: StashError) -> NoReturn:
    typer.echo(json.dumps(err.to_dict(), default=str), err=True)
    raise typer.Exit(2)


def register_store_commands(app: typer.Typer) -> None:
    """Register store and index management commands on the Typer app."""

    @app.command()
    def reindex() -> None:
        """Rebuild the SQLite index from library/ and inventory/ markdown files."""
        try:
            config = load_config()
            counts = rebuild(config.home)
            _print({"status": "ok", "indexed": counts})
        except StashError as e:
            _fail(e)
        except Exception as e:
            _fail(StashError("reindex_failed", str(e)))
