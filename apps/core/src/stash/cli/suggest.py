"""Suggestion CLI commands: suggest matching tools, cards, and practices."""

import json
from typing import Annotated, NoReturn

import typer

from stash.config import load_config
from stash.errors import StashError
from stash.services.suggest import suggest_items


def _print(data: object) -> None:
    typer.echo(json.dumps(data, indent=2, default=str))


def _fail(err: StashError) -> NoReturn:
    typer.echo(json.dumps(err.to_dict(), default=str), err=True)
    raise typer.Exit(2)


def register_suggest_commands(app: typer.Typer) -> None:
    """Register suggest command on the main Typer app."""

    @app.command()
    def suggest(
        query: Annotated[
            str, typer.Argument(help="Task or feature description to consult stash for.")
        ],
        category: Annotated[
            str | None,
            typer.Option("--category", help="Optional category filter (e.g. ui-ux, repos-tools)."),
        ] = None,
        kind: Annotated[
            str | None,
            typer.Option(
                "--kind", help="Optional kind filter (e.g. tool, ui_ref, practice, skill)."
            ),
        ] = None,
        limit: Annotated[int, typer.Option("--limit", "-n", help="Max items per bucket.")] = 5,
        text: Annotated[
            bool, typer.Option("--text", help="Output human-readable markdown instead of JSON.")
        ] = False,
    ) -> None:
        """Suggest installed tools, saved library cards, and practices for a task."""
        try:
            home = load_config().home
            result = suggest_items(home, query, category=category, kind=kind, limit=limit)
            if text:
                if not result.found:
                    typer.echo(f"No relevant items found in stash for: '{query}'.")
                    return

                lines: list[str] = [f"# Stash Suggestions for: '{query}'\n"]
                if result.installed:
                    lines.append("### Installed & Available in Inventory")
                    for item in result.installed:
                        note = f" - {item.note}" if item.note else ""
                        lines.append(f"- **{item.name}** (`{item.kind}`, `{item.origin}`){note}")
                    lines.append("")

                if result.cards:
                    lines.append("### Saved Library Cards")
                    for card in result.cards:
                        tags = f" [{' '.join(card.tags)}]" if card.tags else ""
                        url_part = f" ({card.url})" if card.url else ""
                        lines.append(f"- **{card.title}** (`{card.category}`){url_part}{tags}")
                        if card.snippet:
                            lines.append(f"  > {card.snippet}")
                    lines.append("")

                if result.practices:
                    lines.append("### Relevant Practices & Rules")
                    for practice in result.practices:
                        lines.append(f"- **{practice.name}** (`{practice.origin}`)")
                        if practice.summary:
                            lines.append(f"  > {practice.summary}")
                    lines.append("")

                typer.echo("\n".join(lines).strip())
            else:
                _print(result.model_dump(mode="json"))
        except StashError as e:
            _fail(e)
