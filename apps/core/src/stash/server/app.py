"""FastAPI application factory, security middleware, and central error handlers."""

import asyncio
import contextlib
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from stash import __version__
from stash.config import Config
from stash.errors import Conflict, Invalid, LockTimeout, NotFound, StashError
from stash.server.events import EventHub, run_watcher_loop
from stash.server.routes.cards import router as cards_router
from stash.server.routes.misc import router as misc_router
from stash.server.routes.sources import router as sources_router
from stash.server.routes.state import router as state_router

logger = logging.getLogger("stash.server")

ALLOWED_HOSTS = {"127.0.0.1", "localhost", "testserver"}


class HostSecurityMiddleware(BaseHTTPMiddleware):
    """Guards against DNS rebinding and cross-site request attacks.

    Rejects requests with unknown Host or cross-site Origin headers with 403 Forbidden.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        host_header = request.headers.get("host", "").split(":")[0].strip()
        if host_header and host_header not in ALLOWED_HOSTS:
            return JSONResponse(
                status_code=403,
                content={
                    "error": {
                        "code": "forbidden",
                        "message": f"Forbidden host header: {host_header}",
                        "details": {"host": host_header},
                    }
                },
            )

        origin = request.headers.get("origin")
        if origin:
            # Check origin scheme and domain
            clean_origin = origin.split("://")[-1].split("/")[0].split(":")[0].strip()
            if clean_origin not in ALLOWED_HOSTS:
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": {
                            "code": "forbidden",
                            "message": f"Forbidden origin: {origin}",
                            "details": {"origin": origin},
                        }
                    },
                )

        return await call_next(request)


def create_app(config: Config, dev: bool = False) -> FastAPI:
    """Builds and configures the Link Stash FastAPI application."""
    hub = EventHub()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        app.state.config = config
        app.state.event_hub = hub

        watcher_task = None
        if config.home.is_dir():
            watcher_task = asyncio.create_task(run_watcher_loop(config.home, hub))

        try:
            yield
        finally:
            if watcher_task and not watcher_task.done():
                watcher_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await watcher_task

    app = FastAPI(
        title="Link Stash Library API",
        version=__version__,
        lifespan=lifespan,
    )
    app.state.config = config
    app.state.event_hub = hub

    # Security middleware
    app.add_middleware(HostSecurityMiddleware)

    # 1. Custom StashError Exception Handler
    @app.exception_handler(StashError)
    async def stash_error_handler(_: Request, exc: StashError) -> JSONResponse:
        status_code = 400
        if isinstance(exc, NotFound):
            status_code = 404
        elif isinstance(exc, Conflict):
            status_code = 409
        elif isinstance(exc, Invalid):
            status_code = 422
        elif isinstance(exc, LockTimeout):
            status_code = 503

        return JSONResponse(
            status_code=status_code,
            content=exc.to_dict(),
        )

    # 2. Pydantic / FastAPI RequestValidationError Handler
    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [
            {"field": ".".join(str(p) for p in err["loc"] if p != "body"), "message": err["msg"]}
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Request validation failed",
                    "details": {"fields": fields},
                }
            },
        )

    # 3. Uncaught internal errors handler
    @app.exception_handler(Exception)
    async def general_error_handler(_: Request, exc: Exception) -> JSONResponse:
        logger.error("Unhandled exception: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "An internal server error occurred",
                    "details": {},
                }
            },
        )

    # Register API routers
    app.include_router(cards_router)
    app.include_router(sources_router)
    app.include_router(state_router)
    app.include_router(misc_router)

    # Specific 404 handler for unmatched /api/* routes
    @app.get("/api/{rest_of_path:path}")
    @app.post("/api/{rest_of_path:path}")
    @app.put("/api/{rest_of_path:path}")
    @app.delete("/api/{rest_of_path:path}")
    async def api_not_found(rest_of_path: str) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "not_found",
                    "message": f"API route not found: /api/{rest_of_path}",
                    "details": {"path": f"/api/{rest_of_path}"},
                }
            },
        )

    # Static SPA serving when not running in --dev mode
    if not dev:
        dist_path = config.web_dist
        if dist_path is None:
            # Check relative location: ../../web/dist
            candidate = Path(__file__).resolve().parents[4] / "web" / "dist"
            if (candidate / "index.html").is_file():
                dist_path = candidate

        if dist_path and dist_path.is_dir() and (dist_path / "index.html").is_file():
            assets_dir = dist_path / "assets"
            if assets_dir.is_dir():
                app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

            @app.get("/{full_path:path}")
            async def serve_spa(full_path: str) -> Response:
                requested_file = (dist_path / full_path).resolve()
                if (
                    full_path
                    and requested_file.is_file()
                    and requested_file.is_relative_to(dist_path.resolve())
                ):
                    return FileResponse(requested_file)
                return FileResponse(dist_path / "index.html")

    return app
