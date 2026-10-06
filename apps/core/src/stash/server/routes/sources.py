"""FastAPI routes for sources listing, details, and media streaming."""

import sqlite3
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from starlette.responses import FileResponse

from stash.errors import NotFound
from stash.server.routes.cards import get_db, get_home
from stash.server.schemas import Page, SourceDetail, SourceRow, SourceStagePatch
from stash.services.library import get_source_detail, get_sources_page
from stash.store.queries import get_source_row_by_id
from stash.store.sources import read_source, write_source

router = APIRouter(prefix="/api/sources", tags=["sources"])


@router.get("", response_model=Page[SourceRow])
def list_sources(
    limit: int = Query(50, ge=1, le=200),
    cursor: str | None = None,
    platform: str | None = None,
    creator: str | None = None,
    stage: str | None = None,
    has_video: bool | None = None,
    home: Path = Depends(get_home),
    conn: sqlite3.Connection = Depends(get_db),
) -> Page[SourceRow]:
    """Retrieves paginated source list with filters."""
    return get_sources_page(
        home=home,
        conn=conn,
        limit=limit,
        cursor=cursor,
        platform=platform,
        creator=creator,
        stage=stage,
        has_video=has_video,
    )


@router.get("/{id:path}/video")
def get_source_video(
    id: str,
    home: Path = Depends(get_home),
    conn: sqlite3.Connection = Depends(get_db),
) -> FileResponse:
    """Streams video file supporting HTTP Range requests."""
    row = get_source_row_by_id(conn, id)
    if not row or not row["video"]:
        raise NotFound(f"Video not found for source: {id}", {"source_id": id})

    target = (home / row["video"]).resolve()
    sources_dir = (home / "library" / "sources").resolve()

    try:
        target.relative_to(sources_dir)
    except ValueError as e:
        raise NotFound(
            f"Media path escapes sources directory: {row['video']}", {"source_id": id}
        ) from e

    if not target.is_file():
        raise NotFound(f"Video file missing on disk: {target}", {"source_id": id})

    return FileResponse(path=target, media_type="video/mp4")


@router.get("/{id:path}/thumb")
def get_source_thumb(
    id: str,
    home: Path = Depends(get_home),
    conn: sqlite3.Connection = Depends(get_db),
) -> FileResponse:
    """Returns poster thumbnail image."""
    row = get_source_row_by_id(conn, id)
    if not row or not row["thumb"]:
        raise NotFound(f"Thumbnail not found for source: {id}", {"source_id": id})

    target = (home / row["thumb"]).resolve()
    sources_dir = (home / "library" / "sources").resolve()

    try:
        target.relative_to(sources_dir)
    except ValueError as e:
        raise NotFound(
            f"Media path escapes sources directory: {row['thumb']}", {"source_id": id}
        ) from e

    if not target.is_file():
        raise NotFound(f"Thumbnail file missing on disk: {target}", {"source_id": id})

    return FileResponse(path=target, media_type="image/jpeg")


@router.get("/{id:path}", response_model=SourceDetail)
def get_source(
    id: str,
    home: Path = Depends(get_home),
    conn: sqlite3.Connection = Depends(get_db),
) -> SourceDetail:
    """Retrieves full source metadata, parsed source.md, and linked cards."""
    return get_source_detail(home, conn, id)


@router.patch("/{id:path}/stage", response_model=SourceDetail)
def update_source_stage(
    id: str,
    body: SourceStagePatch,
    home: Path = Depends(get_home),
    conn: sqlite3.Connection = Depends(get_db),
) -> SourceDetail:
    """Updates the processing stage of a source (e.g. to request recheck or advance triage)."""
    get_source_detail(home, conn, id)
    doc = read_source(home, id)
    updated = doc.model_copy(update={"stage": body.stage})
    write_source(home, updated)
    return get_source_detail(home, conn, id)


@router.post("/{id:path}/recheck", response_model=SourceDetail)
def recheck_source(
    id: str,
    home: Path = Depends(get_home),
    conn: sqlite3.Connection = Depends(get_db),
) -> SourceDetail:
    """Sets a triaged source back to analyzed so it enters the triage queue for re-evaluation."""
    get_source_detail(home, conn, id)
    doc = read_source(home, id)
    next_stage = "analyzed" if doc.stage == "triaged" else doc.stage
    updated = doc.model_copy(update={"stage": next_stage})
    write_source(home, updated)
    return get_source_detail(home, conn, id)

