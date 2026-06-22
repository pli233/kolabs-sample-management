"""SQLite metadata model and session helpers."""
from __future__ import annotations

import datetime as _dt

from sqlmodel import Field, Session, SQLModel, create_engine

from .config import settings

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(
            settings.DB_URL, connect_args={"check_same_thread": False}
        )
    return _engine


def reset_engine() -> None:
    """Drop the cached engine so a changed DB_URL takes effect (used by tests)."""
    global _engine
    if _engine is not None:
        _engine.dispose()
    _engine = None


class FileRecord(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    original_filename: str
    stored_path: str
    cache_path: str
    size: int
    content_type: str
    sheet_count: int
    primary_sheet: str = ""  # the user-designated main data sheet
    schema_type: str  # e.g. "main_library" | "unrecognized"
    validation_status: str  # "valid" | "issues" | "unrecognized"
    uploaded_at: _dt.datetime = Field(
        default_factory=lambda: _dt.datetime.now(_dt.timezone.utc)
    )


def init_db() -> None:
    SQLModel.metadata.create_all(get_engine())


def get_session() -> Session:
    return Session(get_engine())
