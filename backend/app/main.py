"""FastAPI application entry point.

    uvicorn app.main:app --reload        (from backend/)

All indexes are built once in the lifespan hook. If frontend/dist exists the
built React app is served from the same origin, so one service runs everything.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .api.routes import router
from .services.state import init_state
from .services.title_search import ClueError

ROOT = Path(__file__).resolve().parents[2]
DIST = Path(os.environ.get("FRONTEND_DIST", ROOT / "frontend" / "dist"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_state()  # builds the C Tries, author Trie and story index exactly once
    yield


app = FastAPI(title="The Library's Half-Remembered Titles", version="1.0.0", lifespan=lifespan)

origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(ClueError)
async def clue_error(_: Request, exc: ClueError):
    return JSONResponse(status_code=422, content={"detail": str(exc), "field": exc.field})


app.include_router(router)

if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        if path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        f = (DIST / path).resolve()
        if path and f.is_file() and DIST.resolve() in f.parents:
            return FileResponse(f)
        return FileResponse(DIST / "index.html")
