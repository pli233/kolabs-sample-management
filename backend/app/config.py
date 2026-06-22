"""Application configuration.

Values are read from environment variables on each access so tests can override
``UPLOAD_DIR`` / ``DB_URL`` via ``monkeypatch.setenv`` without reloading modules.
"""
from __future__ import annotations

import os
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _BACKEND_DIR.parent


class Settings:
    @property
    def UPLOAD_DIR(self) -> Path:
        return Path(os.environ.get("UPLOAD_DIR", str(_BACKEND_DIR / "uploads")))

    @property
    def DB_URL(self) -> str:
        return os.environ.get("DB_URL", f"sqlite:///{_BACKEND_DIR / 'app.db'}")

    @property
    def MAX_FILE_BYTES(self) -> int:
        return int(os.environ.get("MAX_FILE_BYTES", str(50 * 1024 * 1024)))

    @property
    def ALLOWED_EXT(self) -> set[str]:
        return {".xlsx", ".xls", ".csv"}

    @property
    def SAMPLE_XLSX(self) -> Path:
        return _REPO_ROOT / "data" / "数据库下载结果.xlsx"

    @property
    def CORS_ORIGINS(self) -> list[str]:
        return os.environ.get(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")

    def ensure_dirs(self) -> None:
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


settings = Settings()
