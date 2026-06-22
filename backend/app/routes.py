"""API routes: upload, list, detail, raw bytes, parsed data."""
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import select

from . import export, parsing, storage
from .config import settings
from .normalize import normalizer_for
from .tools import box_lookup, qc
from .models import (
    FileRecord,
    get_active_file_id,
    get_session,
    set_active_file_id,
)

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
            detail="Only .xlsx / .xls / .csv files are supported",
        )

    data = await file.read()
    if len(data) > settings.MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 50 MB limit")
    if len(data) == 0:
        raise HTTPException(status_code=422, detail="Empty file")

    stored_path = storage.save_upload(file.filename or f"upload{ext}", data)

    try:
        sheets = parsing.parse_file(stored_path, ext)
    except Exception as exc:  # noqa: BLE001 - surface a readable parse error
        raise HTTPException(status_code=422, detail=f"Could not parse file: {exc}") from exc

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

    # A newly uploaded feed becomes the active data feed.
    set_active_file_id(record.id)

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


class ActiveFeedUpdate(BaseModel):
    file_id: int


@router.get("/active-feed")
def get_active_feed():
    """The data feed that the dashboard and all queries run against."""
    file_id = get_active_file_id()
    if file_id is None:
        return {"active": None}
    with get_session() as session:
        record = session.get(FileRecord, file_id)
    return {"active": _record_to_meta(record) if record else None}


@router.put("/active-feed")
def set_active_feed(payload: ActiveFeedUpdate):
    with get_session() as session:
        record = session.get(FileRecord, payload.file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="File not found")
    set_active_file_id(record.id)
    return _record_to_meta(record)


def _get_record(file_id: int) -> FileRecord:
    with get_session() as session:
        record = session.get(FileRecord, file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="File not found")
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
        raise HTTPException(status_code=400, detail="Sheet not found")

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
        return "Yes"
    if value is False:
        return "No"
    return str(value)


def _sort_key(value):
    """Order key: numbers first (by value), then strings, nulls last."""
    if value is None:
        return (2, 0.0, "")
    if isinstance(value, bool):
        return (1, 0.0, "Yes" if value else "No")
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


def _apply_condition(value, op: str, target: str, normalizer=None) -> bool:
    """Evaluate one column condition against a cell value.

    When ``normalizer`` is given (e.g. box/position columns), both the cell and
    the target are normalized before text comparison so ``A1`` matches ``A01``.
    """
    if op == "is_empty":
        return _is_blank(value)
    if op == "not_empty":
        return not _is_blank(value)

    if normalizer is not None and op not in ("gt", "lt", "gte", "lte"):
        nv, nt = normalizer(value), normalizer(target)
        text = (nv if nv is not None else "").lower()
        t = (nt if nt is not None else "").lower()
    else:
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


def _active_record() -> FileRecord:
    """The active data feed's record, or 404 if none is set."""
    file_id = get_active_file_id()
    record = None
    if file_id is not None:
        with get_session() as session:
            record = session.get(FileRecord, file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="No active data feed")
    return record


_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _xlsx_response(columns: list[str], rows: list[list], filename: str) -> Response:
    data = export.build_xlsx(columns, rows, sheet_name=filename)
    fname = quote(f"{filename}.xlsx")
    return Response(
        content=data,
        media_type=_XLSX_MIME,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{fname}"},
    )


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
        raise HTTPException(status_code=422, detail="File has no displayable sheet")
    return sheet


def _query_rows(
    sheet: dict, q: str, filters: str, match: str, sort: str | None, dir: str
) -> tuple[list[str], list[list], int]:
    """Apply global search + structured filters + sort over a sheet's rows.

    Returns ``(columns, filtered_sorted_rows, total)``. No pagination — callers
    slice (rows endpoint) or take all (export).
    """
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
            raise HTTPException(status_code=400, detail="Invalid filters parameter") from exc

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
                        normalizer_for(c["column"]),
                    )
                    for c in conditions
                ]
                return any(checks) if match == "any" else all(checks)
            return True

        rows = [r for r in rows if passes(r)]

    if sort and sort in col_index:
        ci = col_index[sort]
        rows = sorted(rows, key=lambda r: _sort_key(r[ci]), reverse=(dir == "desc"))

    return columns, rows, total


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
    columns, rows, total = _query_rows(sheet, q, filters, match, sort, dir)

    return {
        "columns": columns,
        "match": sheet["match"],
        "schemaValid": sheet["schemaValid"],
        "issues": sheet["issues"],
        "total": total,
        "filtered": len(rows),
        "offset": offset,
        "limit": limit,
        "rows": rows[offset : offset + limit],
    }


@router.get("/box-lookup")
def box_lookup_route(
    box: str = Query(..., min_length=1),
    format: str = Query("json", pattern="^(json|xlsx)$"),
):
    """Legacy search_box_number: locations + example tubes for a box number,
    against the active feed."""
    sheet = _primary_sheet(_active_record())
    result = box_lookup.lookup_box(sheet, box)
    if format == "xlsx":
        columns, rows = box_lookup.to_table(result)
        return _xlsx_response(columns, rows, f"box_{result['box']}_lookup")
    return result


@router.get("/qc-sample")
def qc_sample_route(
    project: str = Query(..., min_length=1),
    boxes: str = Query(..., min_length=1),
    per_box: int = Query(5, ge=1),
    seed: int | None = Query(None),
    format: str = Query("json", pattern="^(json|xlsx)$"),
):
    """Legacy make_project_box_qc_list: seeded random QC sample per box."""
    import random as _random

    box_list = qc.parse_boxes(boxes)
    if not box_list:
        raise HTTPException(status_code=400, detail="No valid box numbers")
    used_seed = seed if seed is not None else _random.randrange(1, 2**31)

    sheet = _primary_sheet(_active_record())
    result = qc.qc_sample(sheet, project, box_list, per_box, used_seed)
    if format == "xlsx":
        return _xlsx_response(
            result["columns"], result["rows"], f"qc_{project}_seed{used_seed}"
        )
    return result


@router.get("/files/{file_id}/export")
def export_rows(
    file_id: int,
    q: str = Query(""),
    filters: str = Query(""),
    match: str = Query("all", pattern="^(all|any)$"),
    sort: str | None = Query(None),
    dir: str = Query("asc"),
    columns: str = Query("", description="comma-separated column subset/order"),
):
    """Export the current filtered + sorted view as a styled .xlsx download."""
    record = _get_record(file_id)
    sheet = _primary_sheet(record)
    all_columns, rows, _ = _query_rows(sheet, q, filters, match, sort, dir)

    selected = [c for c in columns.split(",") if c in all_columns] or all_columns
    idx = [all_columns.index(c) for c in selected]
    out_rows = [[r[i] for i in idx] for r in rows]

    data = export.build_xlsx(selected, out_rows, sheet_name=record.primary_sheet)
    stem = Path(record.original_filename).stem
    fname = quote(f"{stem}_export.xlsx")
    return Response(
        content=data,
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{fname}"},
    )
