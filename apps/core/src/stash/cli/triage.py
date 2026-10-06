"""Triage CLI commands: extract, scan, have, check, save, reject, pending, queue, skills."""

import json
import sys
from datetime import date
from pathlib import Path
from typing import Annotated, Any, NoReturn

import typer
from pydantic import ValidationError

from stash.config import load_config
from stash.errors import Invalid, StashError
from stash.services.cards import save
from stash.services.check import CheckInput, check_item
from stash.services.extract import extract_urls, failed_urls
from stash.services.inventory import have, scan_inventory
from stash.services.pending import add_pending, list_pending, new_id, resolve_pending
from stash.services.queue import import_ig_export, list_queue, next_queue
from stash.services.rejects import add_reject
from stash.services.skills import install_skills
from stash.store.models import Card, PendingItem

# apps/core/src/stash/cli/triage.py -> repo root
DEFAULT_SKILLS_DIR = Path(__file__).resolve().parents[5] / "skills"


def _print(data: object) -> None:
    typer.echo(json.dumps(data, indent=2, default=str))


def _fail(err: StashError) -> NoReturn:
    typer.echo(json.dumps(err.to_dict(), default=str), err=True)
    raise typer.Exit(2)


def _read_json(path: str) -> dict[str, Any]:
    """Read a JSON object from a file path, or stdin when path is `-`."""
    try:
        text = sys.stdin.read() if path == "-" else Path(path).read_text("utf-8")
        data = json.loads(text)
    except (OSError, json.JSONDecodeError) as e:
        raise Invalid(f"cannot read JSON from {path}: {e}") from e
    if not isinstance(data, dict):
        raise Invalid(f"expected a JSON object in {path}")
    return data  # type: ignore[reportUnknownVariableType]


def _invalid(e: ValidationError) -> Invalid:
    return Invalid("invalid input", {"errors": e.errors(include_url=False)})


def register_triage_commands(app: typer.Typer) -> None:
    """Register triage commands (the CLI surface the agent skills call)."""

    @app.command()
    def extract(
        urls: Annotated[list[str] | None, typer.Argument(help="Links to extract.")] = None,
        retry_failed: Annotated[
            bool, typer.Option("--retry-failed", help="Also retry links in logs/failed.jsonl.")
        ] = False,
    ) -> None:
        """Extract links into sources/ (Instagram, GitHub, HF, Notion, PDF, web)."""
        try:
            home = load_config().home
            todo = [*(urls or []), *(failed_urls(home) if retry_failed else [])]
            if not todo:
                raise Invalid("no links given")
            docs = extract_urls(home, todo)
            _print({"count": len(docs), "sources": [d.model_dump(mode="json") for d in docs]})
        except StashError as e:
            _fail(e)

    @app.command()
    def scan(
        if_stale: Annotated[
            bool, typer.Option("--if-stale", help="Skip when inventory is under 24h old.")
        ] = False,
    ) -> None:
        """Rescan installed tools and models into inventory/auto/."""
        try:
            counts = scan_inventory(load_config().home, if_stale=if_stale)
            _print(
                {"status": "fresh"} if counts is None else {"status": "scanned", "counts": counts}
            )
        except StashError as e:
            _fail(e)

    @app.command("have")
    def have_cmd(text: Annotated[str, typer.Argument(help="Name, URL, or `[kind] name`.")]) -> None:
        """Add one installed thing to inventory/manual/."""
        try:
            _print(have(load_config().home, text).model_dump(mode="json"))
        except StashError as e:
            _fail(e)

    @app.command()
    def check(record: Annotated[str, typer.Argument(help="Candidate JSON file, or `-`.")]) -> None:
        """Check a candidate against library, inventory and rejects."""
        try:
            item = CheckInput.model_validate(_read_json(record))
            _print(check_item(load_config().home, item).model_dump(mode="json"))
        except ValidationError as e:
            _fail(_invalid(e))
        except StashError as e:
            _fail(e)

    @app.command("save")
    def save_cmd(
        card_file: Annotated[
            str, typer.Argument(help="Card JSON (card fields + `body`, optional `slug`), or `-`.")
        ],
    ) -> None:
        """Save a card into library/ and index it."""
        try:
            data = _read_json(card_file)
            body = str(data.pop("body", ""))
            slug = data.pop("slug", None)
            data.setdefault("added", date.today().isoformat())
            card = Card.model_validate(data)
            result = save(load_config().home, card, body, slug=str(slug) if slug else None)
            _print(result.model_dump(mode="json"))
        except ValidationError as e:
            _fail(_invalid(e))
        except StashError as e:
            _fail(e)

    @app.command()
    def reject(
        key: Annotated[str, typer.Argument(help="Canonical key, e.g. github:owner/repo.")],
        reason: Annotated[str, typer.Option("--reason", help="Why it was rejected.")],
    ) -> None:
        """Record a rejection in library/rejected.md."""
        try:
            _print(add_reject(load_config().home, key, reason).model_dump(mode="json"))
        except StashError as e:
            _fail(e)

    @app.command("import-ig-export")
    def import_ig(
        file: Annotated[Path, typer.Argument(help="Instagram saved_posts.json export.")],
    ) -> None:
        """Queue every link from an Instagram saved-posts export."""
        try:
            _print({"queued": import_ig_export(load_config().home, file)})
        except StashError as e:
            _fail(e)

    @app.command("install-skills")
    def install_skills_cmd(
        skills_dir: Annotated[
            Path, typer.Option("--skills-dir", help="Folder holding the skill folders.")
        ] = DEFAULT_SKILLS_DIR,
    ) -> None:
        """Link the stash skills into Claude Code and Antigravity."""
        try:
            _print(install_skills(skills_dir))
        except StashError as e:
            _fail(e)

    pending_app = typer.Typer(help="Comment-for-link and blocked items.", no_args_is_help=True)
    app.add_typer(pending_app, name="pending")

    @pending_app.command("list")
    def pending_list() -> None:
        """List pending items."""
        try:
            _print([p.model_dump(mode="json") for p in list_pending(load_config().home)])
        except StashError as e:
            _fail(e)

    @pending_app.command("add")
    def pending_add(
        item_file: Annotated[str, typer.Argument(help="Pending item JSON, or `-`.")],
    ) -> None:
        """Add a pending item. `id` and `added` are filled in when missing."""
        try:
            data = _read_json(item_file)
            data.setdefault("id", new_id())
            data.setdefault("added", date.today().isoformat())
            item = PendingItem.model_validate(data)
            add_pending(load_config().home, item)
            _print(item.model_dump(mode="json"))
        except ValidationError as e:
            _fail(_invalid(e))
        except StashError as e:
            _fail(e)

    @pending_app.command("resolve")
    def pending_resolve(
        id: Annotated[str, typer.Argument(help="Pending item id.")],
        url: Annotated[str, typer.Option("--url", help="The link received by DM.")],
    ) -> None:
        """Attach the received link and mark the item ready."""
        try:
            _print(resolve_pending(load_config().home, id, url).model_dump(mode="json"))
        except StashError as e:
            _fail(e)

    queue_app = typer.Typer(help="Backlog of links waiting for triage.", no_args_is_help=True)
    app.add_typer(queue_app, name="queue")

    @queue_app.command("list")
    def queue_list() -> None:
        """List queued links."""
        try:
            _print(list_queue(load_config().home))
        except StashError as e:
            _fail(e)

    @queue_app.command("next")
    def queue_next(
        n: Annotated[int, typer.Option("--n", min=1, help="How many links to pop.")] = 15,
    ) -> None:
        """Pop the next links off the queue."""
        try:
            _print(next_queue(load_config().home, n))
        except StashError as e:
            _fail(e)
