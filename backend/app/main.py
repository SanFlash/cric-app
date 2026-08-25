import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.bootstrap import ensure_default_accounts
import app.models  # noqa: F401 — registers all tables on Base.metadata

from app.api.routes import (
    auth, teams, matches, match_scheduling, players, squads, playing_xi, analytics,
    tournaments, leaderboards, notifications, uploads, invites,
)
from app.ws.live_match import router as ws_router

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # For local/dev convenience only. In production, use Alembic migrations.
    Base.metadata.create_all(bind=engine)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Login-ready with zero manual seeding: creates the default admin/umpire
    # accounts (and a company for them to belong to) on first startup only —
    # idempotent, so this is safe to run on every restart/redeploy without
    # creating duplicates or resetting anything that already exists.
    db = SessionLocal()
    try:
        ensure_default_accounts(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok", "env": settings.ENV}


@app.get("/")
def root():
    return {"message": f"{settings.APP_NAME} API", "docs": "/docs", "health": "/health"}


app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(teams.router, prefix=settings.API_V1_PREFIX)
app.include_router(players.router, prefix=settings.API_V1_PREFIX)
app.include_router(squads.router, prefix=settings.API_V1_PREFIX)
app.include_router(playing_xi.router, prefix=settings.API_V1_PREFIX)
app.include_router(analytics.router, prefix=settings.API_V1_PREFIX)
app.include_router(tournaments.router, prefix=settings.API_V1_PREFIX)
app.include_router(leaderboards.router, prefix=settings.API_V1_PREFIX)
app.include_router(notifications.router, prefix=settings.API_V1_PREFIX)
app.include_router(uploads.router, prefix=settings.API_V1_PREFIX)
app.include_router(invites.router, prefix=settings.API_V1_PREFIX)
app.include_router(match_scheduling.router, prefix=settings.API_V1_PREFIX)
app.include_router(matches.router, prefix=settings.API_V1_PREFIX)
app.include_router(ws_router)

# Serve uploaded images. In production, point this at real object storage
# (S3/GCS/R2) instead — local disk won't survive across container restarts
# on most PaaS deploys (Render included).
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)  # StaticFiles needs this to exist at mount time, not just startup
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
