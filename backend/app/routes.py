"""API routes: upload, list, detail, raw bytes, parsed data."""
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import select

from . import parsing, storage
from .config import settings
from .models import FileRecord, get_session

router = APIRouter(prefix="/api")


# --- Primary-sheet logic ----------------------------------------------------
# A workbook can hold several sheets. The user designates one "primary" sheet:
# the file's match status and (future) DB sync follow only that sheet. Other
# sheets stay browsable but never decide the file's verdict.

def _sheet_status(match: str) -> str:
    """Map a sheet's match state to the file-level validation status."""
    return {"matched": "valid", "partial": "issues"}.get(match, "unrecognized")


def _schema_type_for(match: str) -> str:
    return "main_library" if match in ("matched", "partial") else "unrecognized"


def _pick_default_primary(sheets: list[dict]) -> dict | None:
    """Best default for the picker: a fully-matched sheet, else a partial,
    else the first sheet."""
    for preferred in ("matched", "partial"):
        for s in sheets:
            if s["match"] == preferred:
                return s
    return sheets[0] if sheets else None


def _sheet_choices(sheets: list[dict]) -> list[dict]:
    """Compact per-sheet info for the upload-time sheet picker."""
    return [
        {
            "name": s["name"],
            "match": s["match"],
            "rowCount": s["rowCount"],
            "columnCount": len(s["columns"]),
            "schemaValid": s["schemaValid"],
            "issues": s["issues"],
        }
        for s in sheets
    ]


class PrimarySheetUpdate(BaseModel):
    primary_sheet: str


@router.post("/files")
async def upload_file(file: UploadFile):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in settings.ALLOWED_EXT:
        raise HTTPException(
            status_code=415,
            detail="仅支持 xlsx/xls/csv",
        )

    data = await file.read()
    if len(data) > settings.MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="文件超过 50MB 上限")
    if len(data) == 0:
        raise HTTPException(status_code=422, detail="空文件")

    stored_path = storage.save_upload(file.filename or f"upload{ext}", data)

    try:
        sheets = parsing.parse_file(stored_path, ext)
    except Exception as exc:  # noqa: BLE001 - surface a readable parse error
        raise HTTPException(status_code=422, detail=f"无法解析文件: {exc}") from exc

    cache_path = storage.save_parsed(stored_path, sheets)

    default_primary = _pick_default_primary(sheets)
    primary_name = default_primary["name"] if default_primary else ""
    primary_match = default_primary["match"] if default_primary else "other"

    record = FileRecord(
        original_filename=file.filename or f"upload{ext}",
        stored_path=stored_path,
        cache_path=cache_path,
        size=len(data),
        content_type=file.content_type or "application/octet-stream",
        sheet_count=len(sheets),
        primary_sheet=primary_name,
        schema_type=_schema_type_for(primary_match),
        validation_status=_sheet_status(primary_match),
    )
    with get_session() as session:
        session.add(record)
        session.commit()
        session.refresh(record)

    # The frontend shows a sheet picker when there's more than one sheet,
    # pre-selecting `primary_sheet`. Single-sheet files skip the picker.
    return {
        **_record_to_meta(record),
        "sheets": _sheet_choices(sheets),
    }


def _record_to_meta(r: FileRecord) -> dict:
    return {
        "id": r.id,
        "original_filename": r.original_filename,
        "size": r.size,
        "sheet_count": r.sheet_count,
        "primary_sheet": r.primary_sheet,
        "schema_type": r.schema_type,
        "validation_status": r.validation_status,
        "uploaded_at": r.uploaded_at.isoformat(),
    }


@router.get("/files")
def list_files():
    with get_session() as session:
        records = session.exec(
            select(FileRecord).order_by(FileRecord.uploaded_at.desc())
        ).all()
        return [_record_to_meta(r) for r in records]


def _get_record(file_id: int) -> FileRecord:
    with get_session() as session:
        record = session.get(FileRecord, file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="文件不存在")
    return record


@router.get("/files/{file_id}")
def get_file(file_id: int):
    return _record_to_meta(_get_record(file_id))


@router.patch("/files/{file_id}")
def set_primary_sheet(file_id: int, payload: PrimarySheetUpdate):
    """Designate which sheet is the file's primary (data) sheet."""
    record = _get_record(file_id)
    parsed = storage.load_parsed(record.cache_path)
    sheet = next(
        (s for s in parsed["sheets"] if s["name"] == payload.primary_sheet), None
    )
    if sheet is None:
        raise HTTPException(status_code=400, detail="该工作表不存在")

    with get_session() as session:
        record = session.get(FileRecord, file_id)
        record.primary_sheet = sheet["name"]
        record.validation_status = _sheet_status(sheet["match"])
        record.schema_type = _schema_type_for(sheet["match"])
        session.add(record)
        session.commit()
        session.refresh(record)
    return _record_to_meta(record)


@router.get("/files/{file_id}/raw")
def get_raw(file_id: int):
    record = _get_record(file_id)
    data = storage.read_raw(record.stored_path)
    # RFC 5987: encode non-latin1 filenames so the header is HTTP-safe.
    encoded = quote(record.original_filename)
    headers = {"Content-Disposition": f"inline; filename*=UTF-8''{encoded}"}
    return Response(content=data, media_type=record.content_type, headers=headers)


def _cell_text(value) -> str:
    if value is None:
        return ""
    if value is True:
        return "是"
    if value is False:
        return "否"
    return str(value)


def _sort_key(value):
    """Order key: numbers first (by value), then strings, nulls last."""
    if value is None:
        return (2, 0.0, "")
    if isinstance(value, bool):
        return (1, 0.0, "是" if value else "否")
    if isinstance(value, (int, float)):
        return (0, float(value), "")
    return (1, 0.0, str(value).lower())


def _num(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def _is_blank(value) -> bool:
    return value is None or _cell_text(value).strip() == ""


def _apply_condition(value, op: str, target: str) -> bool:
    """Evaluate one column condition against a cell value."""
    if op == "is_empty":
        return _is_blank(value)
    if op == "not_empty":
        return not _is_blank(value)

    text = _cell_text(value).lower()
    t = (target or "").lower()

    if op == "contains":
        return t in text
    if op == "not_contains":
        return t not in text
    if op == "equals":
        return text == t
    if op == "not_equals":
        return text != t
    if op == "starts_with":
        return text.startswith(t)
    if op == "ends_with":
        return text.endswith(t)
    if op in ("gt", "lt", "gte", "lte"):
        a, b = _num(value), _num(target)
        if a is not None and b is not None:
            return {"gt": a > b, "lt": a < b, "gte": a >= b, "lte": a <= b}[op]
        # Blank cells never satisfy an inequality; otherwise compare as strings.
        if _is_blank(value):
            return False
        return {"gt": text > t, "lt": text < t, "gte": text >= t, "lte": text <= t}[op]
    return True


def _primary_sheet(record: FileRecord) -> dict:
    try:
        parsed = storage.load_parsed(record.cache_path)
    except FileNotFoundError:
        ext = Path(record.stored_path).suffix.lower()
        parsed = {"sheets": parsing.parse_file(record.stored_path, ext)}
    sheets = parsed["sheets"]
    sheet = next(
        (s for s in sheets if s["name"] == record.primary_sheet),
        sheets[0] if sheets else None,
    )
    if sheet is None:
        raise HTTPException(status_code=422, detail="文件没有可展示的工作表")
    return sheet


@router.get("/files/{file_id}/rows")
def get_rows(
    file_id: int,
    offset: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=2000),
    q: str = Query(""),
    filters: str = Query("", description="JSON list of {column, op, value}"),
    match: str = Query("all", pattern="^(all|any)$"),
    sort: str | None = Query(None),
    dir: str = Query("asc"),
):
    """Paginated rows of the primary sheet. Global search (``q``) plus per-column
    structured conditions (``filters``, combined by ``match`` = all/any) are
    applied across ALL rows server-side, then sorted and sliced."""
    record = _get_record(file_id)
    sheet = _primary_sheet(record)
    columns: list[str] = sheet["columns"]
    rows: list[list] = sheet["rows"]
    total = len(rows)
    col_index = {c: i for i, c in enumerate(columns)}

    conditions: list[dict] = []
    if filters:
        try:
            parsed = json.loads(filters)
            conditions = [c for c in parsed if c.get("column") in col_index]
        except (ValueError, AttributeError, TypeError) as exc:
            raise HTTPException(status_code=400, detail="filters 参数格式错误") from exc

    if q or conditions:
        needle = q.lower()

        def passes(row: list) -> bool:
            if q and not any(needle in _cell_text(c).lower() for c in row):
                return False
            if conditions:
                checks = [
                    _apply_condition(
                        row[col_index[c["column"]]], c.get("op", "contains"),
                        str(c.get("value", "")),
                    )
                    for c in conditions
                ]
                return any(checks) if match == "any" else all(checks)
            return True

        rows = [r for r in rows if passes(r)]
    filtered = len(rows)

    if sort and sort in col_index:
        ci = col_index[sort]
        rows = sorted(rows, key=lambda r: _sort_key(r[ci]), reverse=(dir == "desc"))

    page = rows[offset : offset + limit]
    return {
        "columns": columns,
        "match": sheet["match"],
        "schemaValid": sheet["schemaValid"],
        "issues": sheet["issues"],
        "total": total,
        "filtered": filtered,
        "offset": offset,
        "limit": limit,
        "rows": page,
    }
