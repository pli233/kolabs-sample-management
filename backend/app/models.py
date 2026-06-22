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


class AppSetting(SQLModel, table=True):
    """Tiny key/value store for app-wide singletons (e.g. the active feed)."""

    key: str = Field(primary_key=True)
    value: str


_ACTIVE_FEED_KEY = "active_file_id"


def init_db() -> None:
    SQLModel.metadata.create_all(get_engine())


def get_session() -> Session:
    return Session(get_engine())


def get_active_file_id() -> int | None:
    with get_session() as session:
        setting = session.get(AppSetting, _ACTIVE_FEED_KEY)
        if setting is None or not setting.value:
            return None
        try:
            return int(setting.value)
        except ValueError:
            return None


def set_active_file_id(file_id: int | None) -> None:
    value = "" if file_id is None else str(file_id)
    with get_session() as session:
        setting = session.get(AppSetting, _ACTIVE_FEED_KEY)
        if setting is None:
            setting = AppSetting(key=_ACTIVE_FEED_KEY, value=value)
        else:
            setting.value = value
        session.add(setting)
        session.commit()
