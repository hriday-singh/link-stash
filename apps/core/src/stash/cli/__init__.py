"""Typer commands. Thin: parse args, call services, print JSON."""

import json
import shutil
import sys
from typing import NoReturn

import typer

from stash.cli.reel import register_reel_commands
from stash.cli.serve import register_serve_commands
from stash.cli.store import register_store_commands
from stash.cli.suggest import register_suggest_commands
from stash.cli.triage import register_triage_commands
from stash.config import load_config
from stash.errors import StashError

app = typer.Typer(help="Link Stash: extract, triage and store saved links.", no_args_is_help=True)
register_reel_commands(app)
register_serve_commands(app)
register_store_commands(app)
register_suggest_commands(app)
register_triage_commands(app)


REQUIRED_TOOLS = ("ffmpeg", "agy", "gh")


def _print(data: object) -> None:
    typer.echo(json.dumps(data, indent=2, default=str))


def _fail(err: StashError) -> NoReturn:
    typer.echo(json.dumps(err.to_dict(), default=str), err=True)
    raise typer.Exit(2)


@app.callback()
def main() -> None:
    """Link Stash core CLI."""


@app.command()
def doctor() -> None:
    """Show the resolved STASH_HOME and check required tools are on PATH."""
    try:
        config = load_config()
    except StashError as e:
        _fail(e)
    tools = {name: shutil.which(name) for name in REQUIRED_TOOLS}
    _print(
        {
            "home": str(config.home),
            "home_exists": config.home.is_dir(),
            "python": sys.version.split()[0],
            "tools": tools,
        }
    )
    if not all(tools.values()):
        raise typer.Exit(1)
