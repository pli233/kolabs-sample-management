"""Application configuration.

Values are read from environment variables on each access so tests can override
``DB_URL`` via ``monkeypatch.setenv`` without reloading modules.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _BACKEND_DIR.parent


def _default_db_path() -> Path:
    """Where to keep the SQLite file. In the packaged Mac app the bundle is
    read-only, so write to the user's Application Support dir; in dev use the
    repo's backend/ dir."""
    if getattr(sys, "frozen", False):
        base = Path.home() / "Library" / "Application Support" / "Kolabs Sample Management"
        base.mkdir(parents=True, exist_ok=True)
        return base / "app.db"
    return _BACKEND_DIR / "app.db"


class Settings:
    @property
    def DB_URL(self) -> str:
        return os.environ.get("DB_URL", f"sqlite:///{_default_db_path()}")

    @property
    def MAX_FILE_BYTES(self) -> int:
        return int(os.environ.get("MAX_FILE_BYTES", str(50 * 1024 * 1024)))

    @property
    def ALLOWED_EXT(self) -> set[str]:
        return {".xlsx", ".xls", ".csv"}

    @property
    def SAMPLE_XLSX(self) -> Path:
        return _REPO_ROOT / "data" / "sample_database.xlsx"

    @property
    def CORS_ORIGINS(self) -> list[str]:
        return os.environ.get(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")


settings = Settings()
