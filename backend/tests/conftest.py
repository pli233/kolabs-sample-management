"""Shared pytest fixtures.

Each test gets an isolated SQLite DB via env var. Settings read env lazily, so no
module reloading is needed — we just reset the cached engine and recreate tables
against the fresh DB.
"""
from __future__ import annotations

from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SAMPLE_XLSX = _REPO_ROOT / "data" / "sample_database.xlsx"


@pytest.fixture
def sample_xlsx_path() -> Path:
    assert SAMPLE_XLSX.exists(), f"missing fixture: {SAMPLE_XLSX}"
    return SAMPLE_XLSX


@pytest.fixture
def app_env(tmp_path, monkeypatch):
    """Isolate the DB for one test."""
    monkeypatch.setenv("DB_URL", f"sqlite:///{tmp_path / 'test.db'}")

    import app.main as main
    import app.models as models

    models.reset_engine()
    models.init_db()
    yield main
    models.reset_engine()


@pytest.fixture
def client(app_env):
    from fastapi.testclient import TestClient

    return TestClient(app_env.app)
