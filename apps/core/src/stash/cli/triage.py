"""Triage CLI commands: extract, scan, have, check, save, reject, pending, skills."""

import json
import sys
from collections.abc import Callable
from datetime import date
from pathlib import Path
from typing import Annotated, Any, NoReturn, cast

import typer
from pydantic import ValidationError

from stash.config import load_config
from stash.errors import Invalid, StashError
from stash.services.cards import save
from stash.services.check import CheckInput, check_item
from stash.services.extract import extract_urls, failed_urls
from stash.services.inventory import have, have_batch, scan_inventory
from stash.services.pending import add_pending, list_pending, new_id, resolve_pending
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


def _load(path: str) -> object:
    try:
        text = sys.stdin.read() if path == "-" else Path(path).read_text("utf-8")
        return json.loads(text)
    except (OSError, json.JSONDecodeError) as e:
        raise Invalid(f"cannot read JSON from {path}: {e}") from e


def _objects(data: object) -> list[dict[str, Any]] | None:
    """`data` as a list of JSON objects, or None when it is not an array of objects."""
    if isinstance(data, list) and all(isinstance(d, dict) for d in data):  # type: ignore[reportUnknownVariableType]
        return cast(list[dict[str, Any]], data)
    return None


def _read_json(path: str) -> dict[str, Any]:
    """Read a JSON object from a file path, or stdin when path is `-`."""
    data = _load(path)
    if not isinstance(data, dict):
        raise Invalid(f"expected a JSON object in {path}")
    return cast(dict[str, Any], data)


def _batch(items: list[dict[str, Any]], one: Callable[[dict[str, Any]], Any]) -> None:
    """Run `one` per item; failures become `{"error": ...}` rows. Exit 2 if any row failed."""
    out: list[Any] = []
    for data in items:
        try:
            out.append(one(data))
        except ValidationError as e:
            out.append(_invalid(e).to_dict())
        except StashError as e:
            out.append(e.to_dict())
    _print(out)
    if any(isinstance(r, dict) and "error" in r for r in out):
        raise typer.Exit(2)


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
    def have_cmd(
        text: Annotated[str, typer.Argument(help="Name, URL, `[kind] name`, or `-` for stdin.")],
    ) -> None:
        """Add one or more installed things to inventory/manual/."""
        try:
            home = load_config().home
            if text == "-":
                raw = sys.stdin.read()
                lines = [line.strip() for line in raw.splitlines() if line.strip()]
                if not lines:
                    raise Invalid("nothing to add: empty input")
                if len(lines) == 1:
                    _print(have(home, lines[0]).model_dump(mode="json"))
                else:
                    results = have_batch(home, lines)
                    _print([r.model_dump(mode="json") for r in results])
            elif "\n" in text:
                lines = [line.strip() for line in text.splitlines() if line.strip()]
                results = have_batch(home, lines)
                _print([r.model_dump(mode="json") for r in results])
            else:
                _print(have(home, text).model_dump(mode="json"))
        except StashError as e:
            _fail(e)

    @app.command()
    def check(
        record: Annotated[str, typer.Argument(help="Candidate JSON file, URL, name, or `-`.")],
        live: Annotated[
            bool,
            typer.Option("--live", help="Also probe the URL: dead, archived, stale, redirected."),
        ] = False,
    ) -> None:
        """Check a candidate (or, via `-`, a JSON array of candidates) against library,
        inventory and rejects."""
        try:
            home = load_config().home
            if record == "-":
                raw = sys.stdin.read().strip()
                try:
                    data = json.loads(raw)
                    if (rows := _objects(data)) is not None:
                        _batch(
                            rows,
                            lambda d: check_item(
                                home, CheckInput.model_validate(d), live=live
                            ).model_dump(mode="json"),
                        )
                        return
                    if isinstance(data, dict):
                        item = CheckInput.model_validate(data)
                    else:
                        raise Invalid(
                            f"expected a JSON object or array of objects, got {type(data).__name__}"
                        )
                except json.JSONDecodeError:
                    if raw.startswith(("http://", "https://")):
                        item = CheckInput(url=raw)
                    else:
                        item = CheckInput(name=raw)
            elif record.startswith(("http://", "https://")):
                item = CheckInput(url=record)
            elif not Path(record).exists() and not record.endswith((".json", ".jsonl")):
                item = CheckInput(name=record)
            else:
                item = CheckInput.model_validate(_read_json(record))
            _print(check_item(home, item, live=live).model_dump(mode="json"))
        except ValidationError as e:
            _fail(_invalid(e))
        except StashError as e:
            _fail(e)

    @app.command("save")
    def save_cmd(
        card_file: Annotated[
            str | None,
            typer.Argument(help="Card JSON (card fields + `body`, optional `slug`), or `-`."),
        ] = None,
        url: Annotated[str | None, typer.Option("--url", help="Link; key is derived.")] = None,
        key: Annotated[str | None, typer.Option("--key", help="Canonical key.")] = None,
        title: Annotated[str | None, typer.Option("--title")] = None,
        category: Annotated[str | None, typer.Option("--category")] = None,
        kind: Annotated[str | None, typer.Option("--kind")] = None,
        tags: Annotated[list[str] | None, typer.Option("--tag", help="Repeatable.")] = None,
        bucket: Annotated[
            str | None, typer.Option("--bucket", help="try-now, later, upgrade or inspiration.")
        ] = None,
        source: Annotated[
            list[str] | None, typer.Option("--source", help="Source key. Repeatable.")
        ] = None,
        body: Annotated[str | None, typer.Option("--body", help="Card markdown body.")] = None,
    ) -> None:
        """Save a card (or a JSON array of cards) into library/ and index it.

        Flags override fields from the JSON; with an array they apply to every card.
        """
        flags = {
            "url": url, "key": key, "title": title, "category": category, "kind": kind,
            "tags": tags, "bucket": bucket, "sources": source, "body": body,
        }  # fmt: skip
        set_flags = {k: v for k, v in flags.items() if v is not None}

        def one(data: dict[str, Any]) -> Any:
            data = {**data, **set_flags}
            if data.get("url") and "key" not in data:
                from stash.services.inventory import key_for_url

                data["key"], derived_kind, _ = key_for_url(str(data["url"]))
                data.setdefault("kind", derived_kind)
            body_text = str(data.pop("body", ""))
            slug = data.pop("slug", None)
            data.setdefault("added", date.today().isoformat())
            card = Card.model_validate(data)
            result = save(load_config().home, card, body_text, slug=str(slug) if slug else None)
            return result.model_dump(mode="json")

        try:
            data: object = _load(card_file) if card_file else {}
            if (rows := _objects(data)) is not None:
                _batch(rows, one)
            elif isinstance(data, dict):
                _print(one(cast(dict[str, Any], data)))
            else:
                raise Invalid(f"expected a JSON object or array of objects in {card_file}")
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

    @app.command("install-skills")
    def install_skills_cmd(
        skills_dir: Annotated[
            Path, typer.Option("--skills-dir", help="Folder holding the skill folders.")
        ] = DEFAULT_SKILLS_DIR,
        mode: Annotated[
            str,
            typer.Option(
                "--mode", help="Installation mode: 'copy' (default, universal) or 'symlink'."
            ),
        ] = "copy",
        workspace: Annotated[
            bool,
            typer.Option("--workspace", "-w", help="Also install into .agents/skills in project."),
        ] = False,
    ) -> None:
        """Link or copy the stash skills into Claude Code and Antigravity."""
        try:
            if mode not in ("copy", "symlink"):
                raise Invalid(f"invalid install mode: {mode!r}, expected 'copy' or 'symlink'")
            _print(install_skills(skills_dir, mode=mode, workspace=workspace))
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
        item_file: Annotated[str | None, typer.Argument(help="Pending item JSON, or `-`.")] = None,
        kind: Annotated[
            str | None, typer.Option("--kind", help="cta (comment/DM for link) or blocked.")
        ] = None,
        source: Annotated[str | None, typer.Option("--source", help="Source key.")] = None,
        instruction: Annotated[
            str | None, typer.Option("--instruction", help="What the user must do.")
        ] = None,
        url: Annotated[str | None, typer.Option("--url")] = None,
    ) -> None:
        """Add a pending item. `id` and `added` are filled in when missing."""
        try:
            data = _read_json(item_file) if item_file else {}
            flags = {"kind": kind, "source_key": source, "instruction": instruction, "url": url}
            data.update({k: v for k, v in flags.items() if v is not None})
            data.setdefault("kind", "cta")
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
