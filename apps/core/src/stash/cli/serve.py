"""Typer CLI commands for serving the web application and generating OpenAPI schema."""

import json
from pathlib import Path

import typer

from stash.config import load_config
from stash.errors import StashError
from stash.server.app import create_app


def register_serve_commands(app: typer.Typer) -> None:
    """Registers `stash serve` and `stash openapi` commands."""

    @app.command()
    def serve(
        port: int | None = typer.Option(None, "--port", "-p", help="Port to bind (default 8765)"),
        dev: bool = typer.Option(
            False, "--dev", help="Run in dev API-only mode without static SPA"
        ),
    ) -> None:
        """Starts the Link Stash library server and serves the web frontend."""
        import uvicorn

        try:
            config = load_config()
        except StashError as e:
            typer.echo(json.dumps(e.to_dict()), err=True)
            raise typer.Exit(2) from e

        resolved_port = port or config.port

        if not dev:
            dist_path = config.web_dist
            if dist_path is None:
                candidate = Path(__file__).resolve().parents[4] / "web" / "dist"
                dist_path = candidate if (candidate / "index.html").is_file() else None

            if not dist_path or not (dist_path / "index.html").is_file():
                typer.echo(
                    f"Web app distribution not found at {dist_path}.\n"
                    "Build the web application first with 'npm run build' inside apps/web, "
                    "or pass '--dev' to run the API-only server.",
                    err=True,
                )
                raise typer.Exit(1)

        server_app = create_app(config, dev=dev)
        uvicorn.run(server_app, host="127.0.0.1", port=resolved_port, log_level="info")

    @app.command()
    def openapi() -> None:
        """Outputs the OpenAPI JSON schema for TypeScript type generation."""
        try:
            config = load_config()
        except StashError as e:
            typer.echo(json.dumps(e.to_dict()), err=True)
            raise typer.Exit(2) from e

        server_app = create_app(config, dev=True)
        schema = server_app.openapi()
        typer.echo(json.dumps(schema, indent=2))
