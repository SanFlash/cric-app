"""
Central configuration. All values overridable via environment variables / .env.
"""
from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Anchor the default SQLite path to this file's own location (backend/app/core/)
# rather than the process's current working directory. A relative path like
# "sqlite:///./corpcric.db" resolves differently depending on whether you
# launched Python from backend/, the repo root, or anywhere else — which
# silently creates a SECOND, empty database file elsewhere, while the server
# keeps reading the original. This computes one fixed, deterministic location
# (backend/corpcric.db) no matter where any script or server is invoked from.
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_DEFAULT_SQLITE_PATH = _BACKEND_DIR / "corpcric.db"


class Settings(BaseSettings):
    # --- App ---
    APP_NAME: str = "Corporate Cricket Platform"
    ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # --- Security ---
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30d

    # --- Database ---
    DATABASE_URL: str = f"sqlite:///{_DEFAULT_SQLITE_PATH}"

    # --- CORS ---
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173", "http://127.0.0.1:5173",   # vite dev
        "http://localhost:4173", "http://127.0.0.1:4173",   # vite preview (production build, local test)
        "http://localhost:3000", "http://127.0.0.1:3000",
    ]

    # --- Rate limiting ---
    RATE_LIMIT_PER_MINUTE: int = 120

    # --- File uploads ---
    MAX_UPLOAD_MB: int = 5
    ALLOWED_IMAGE_TYPES: list[str] = ["image/jpeg", "image/png", "image/webp"]
    UPLOAD_DIR: str = "./uploads"

<<<<<<< HEAD
    # --- Default login accounts, auto-created on first startup ---
    # Overridable via env vars for anyone who wants different credentials
    # (e.g. a real deployment beyond a private demo). Both seed_demo.py and
    # the app's own startup hook create from these same values, so there's
    # one source of truth instead of two places that could drift apart.
    DEFAULT_COMPANY_NAME: str = "My Organization"
    DEFAULT_ADMIN_EMAIL: str = "admin@acme.com"
    DEFAULT_ADMIN_PASSWORD: str = "admin12345"
    DEFAULT_ADMIN_NAME: str = "Admin"
    DEFAULT_UMPIRE_EMAIL: str = "umpire@acme.com"
    DEFAULT_UMPIRE_PASSWORD: str = "umpire12345"
    DEFAULT_UMPIRE_NAME: str = "Umpire"

=======
>>>>>>> 2b62d77b1fb08b6a939484d5f898e3166fe708b0
    # --- Prediction engine weights (admin-configurable defaults) ---
    RATING_WEIGHT_BATTING: float = 0.25
    RATING_WEIGHT_BOWLING: float = 0.25
    RATING_WEIGHT_FIELDING: float = 0.15
    RATING_WEIGHT_FORM: float = 0.20
    RATING_WEIGHT_CONSISTENCY: float = 0.10
    RATING_WEIGHT_PRESSURE: float = 0.05

    FORM_WEIGHT_LAST_MATCH: float = 0.30
    FORM_WEIGHT_LAST_2_3: float = 0.25
    FORM_WEIGHT_LAST_4_5: float = 0.20
    FORM_WEIGHT_LONG_TERM: float = 0.25

    # --- Tournament points system (admin-configurable) ---
    POINTS_WIN: int = 2
    POINTS_TIE: int = 1
    POINTS_NO_RESULT: int = 1
    POINTS_LOSS: int = 0

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
