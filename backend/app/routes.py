"""API routes: upload, list, detail, raw bytes, parsed data."""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import select

from . import export, parsing, storage
from .config import settings
from .normalize import normalizer_for
from .tools import aliquot, box_lookup, qc, scan
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


class ExportTableBody(BaseModel):
    columns: list[str]
    rows: list[list]
    filename: str = "export"
    fmt: str = "xlsx"


@router.post("/export-table")
def export_table(body: ExportTableBody):
    """Download an arbitrary client-side table (e.g. a Scan Reconcile category)
    as .xlsx or .csv."""
    fmt = body.fmt if body.fmt in ("xlsx", "csv") else "xlsx"
    return _table_response(body.columns, body.rows, body.filename or "export", fmt)


class ApplyPositionBody(BaseModel):
    record_id: int | str
    box: int | str | None = None
    sample_pos: str | None = None


class ApplyPositionsBody(BaseModel):
    items: list[ApplyPositionBody]


def _apply_positions(items: list[ApplyPositionBody]) -> int:
    """Write box/sample_pos for the given records into the active feed (one DB
    write). Used by single and batch apply, and by revoke (expected values)."""
    record = _active_record()
    parsed = storage.load_parsed(record.id, record.parsed_json)
    sheets = parsed["sheets"]
    sheet = next(
        (s for s in sheets if s["name"] == record.primary_sheet),
        sheets[0] if sheets else None,
    )
    if sheet is None:
        raise HTTPException(status_code=422, detail="Feed has no sheet to edit")

    idx = {c: i for i, c in enumerate(sheet["columns"])}
    ri, bi, pi = idx.get("record_id"), idx.get("box"), idx.get("sample_pos")
    if ri is None:
        raise HTTPException(status_code=400, detail="Feed has no record_id column")

    by_id: dict[str, list] = {}
    for r in sheet["rows"]:
        by_id.setdefault(str(r[ri]), r)

    applied = 0
    for it in items:
        target = by_id.get(str(it.record_id))
        if target is None:
            continue
        if it.box is not None and bi is not None:
            target[bi] = it.box
        if it.sample_pos is not None and pi is not None:
            target[pi] = it.sample_pos
        applied += 1

    if applied:
        new_json = storage.dump_parsed(sheets)
        with get_session() as session:
            rec = session.get(FileRecord, record.id)
            rec.parsed_json = new_json
            session.add(rec)
            session.commit()
        storage.clear_cache()
    return applied


def _first_present(index: dict[str, int], *names: str) -> int | None:
    for name in names:
        hit = index.get(name.lower())
        if hit is not None:
            return hit
    return None


def _confirmed(value) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "y", "x"}


@router.post("/reconcile/apply-position")
def apply_position(body: ApplyPositionBody):
    """Reconcile fix for one record (write box/sample_pos to the active feed)."""
    if _apply_positions([body]) == 0:
        raise HTTPException(status_code=404, detail="record_id not found in feed")
    return {"applied": 1}


@router.post("/reconcile/apply-positions")
def apply_positions(body: ApplyPositionsBody):
    """Batch apply: write many records' box/sample_pos in one DB write."""
    return {"applied": _apply_positions(body.items)}


@router.post("/scan-reconcile/import-review")
async def import_scan_reconcile_review(file: UploadFile = File(...)):
    """Apply reconcile updates from an exported review file.

    The file must contain `confirm_update`, `record_id`, and scanned/scan
    location columns. Rows with `confirm_update = 1` are written back into the
    active feed.
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".xlsx", ".csv"}:
        raise HTTPException(
            status_code=415,
            detail="Only exported .xlsx / .csv review files are supported",
        )

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=422, detail="Empty file")

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        sheets = parsing.parse_file(tmp_path, ext)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"Could not parse file: {exc}") from exc
    finally:
        os.unlink(tmp_path)

    sheet = next((s for s in sheets if s["columns"] or s["rows"]), None)
    if sheet is None:
        raise HTTPException(status_code=422, detail="Review file has no readable rows")

    columns = [str(c).strip() for c in sheet["columns"]]
    idx = {column.lower(): i for i, column in enumerate(columns)}
    record_i = _first_present(idx, "record_id", "db_record_id")
    confirm_i = _first_present(idx, "confirm_update")
    box_i = _first_present(idx, "scanned_box", "scan_box", "box")
    pos_i = _first_present(idx, "scanned_position", "scan_position", "sample_pos", "position")

    if record_i is None or confirm_i is None or box_i is None or pos_i is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Review file must include record_id, confirm_update, "
                "and scanned_box/scanned_position columns"
            ),
        )

    def cell(row: list, i: int | None):
        return row[i] if i is not None and i < len(row) else None

    flagged = 0
    items: list[ApplyPositionBody] = []
    for row in sheet["rows"]:
        if not _confirmed(cell(row, confirm_i)):
            continue
        flagged += 1
        record_id = cell(row, record_i)
        if record_id in (None, ""):
            continue
        sample_pos = cell(row, pos_i)
        items.append(
            ApplyPositionBody(
                record_id=record_id,
                box=cell(row, box_i),
                sample_pos=None if sample_pos in (None, "") else str(sample_pos).strip(),
            )
        )

    return {"flagged": flagged, "applied": _apply_positions(items)}


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

    # Parse from a temp file (openpyxl/csv read a path), then delete it — the
    # parsed result is stored in the DB, so nothing persists on disk.
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        sheets = parsing.parse_file(tmp_path, ext)
    except Exception as exc:  # noqa: BLE001 - surface a readable parse error
        raise HTTPException(status_code=422, detail=f"Could not parse file: {exc}") from exc
    finally:
        os.unlink(tmp_path)

    default_primary = _pick_default_primary(sheets)
    primary_name = default_primary["name"] if default_primary else ""
    primary_match = default_primary["match"] if default_primary else "other"

    record = FileRecord(
        original_filename=file.filename or f"upload{ext}",
        parsed_json=storage.dump_parsed(sheets),
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


@router.delete("/files/{file_id}")
def delete_file(file_id: int):
    """Delete a feed. If it was the active feed, reassign to the most recent
    remaining feed (or none)."""
    _get_record(file_id)  # 404 if missing
    with get_session() as session:
        rec = session.get(FileRecord, file_id)
        if rec is not None:
            session.delete(rec)
            session.commit()

    new_active = None
    if get_active_file_id() == file_id:
        with get_session() as session:
            nxt = session.exec(
                select(FileRecord).order_by(FileRecord.uploaded_at.desc())
            ).first()
        set_active_file_id(nxt.id if nxt else None)
        new_active = nxt.id if nxt else None

    return {"deleted": file_id, "active": new_active}


@router.patch("/files/{file_id}")
def set_primary_sheet(file_id: int, payload: PrimarySheetUpdate):
    """Designate which sheet is the file's primary (data) sheet."""
    record = _get_record(file_id)
    parsed = storage.load_parsed(record.id, record.parsed_json)
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


def _table_response(
    columns: list[str], rows: list[list], filename: str, fmt: str = "xlsx"
) -> Response:
    if fmt == "csv":
        data = export.build_csv(columns, rows)
        media, ext = "text/csv; charset=utf-8", "csv"
    else:
        data = export.build_xlsx(columns, rows, sheet_name=filename)
        media, ext = _XLSX_MIME, "xlsx"
    fname = quote(f"{filename}.{ext}")
    return Response(
        content=data,
        media_type=media,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{fname}"},
    )


def _primary_sheet(record: FileRecord) -> dict:
    parsed = storage.load_parsed(record.id, record.parsed_json)
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


@router.get("/files/{file_id}/overview")
def get_overview(file_id: int):
    """Aggregate counts of the primary sheet for the dashboard charts."""
    from collections import Counter

    sheet = _primary_sheet(_get_record(file_id))
    columns: list[str] = sheet["columns"]
    rows: list[list] = sheet["rows"]
    idx = {c: i for i, c in enumerate(columns)}

    def counts(col: str, top: int | None = None) -> list[dict]:
        if col not in idx:
            return []
        i = idx[col]
        c: Counter = Counter()
        for r in rows:
            v = r[i]
            if v is not None and str(v).strip() != "":
                c[str(v).strip()] += 1
        items = sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))
        if top:
            items = items[:top]
        return [{"name": k, "count": v} for k, v in items]

    by_project = counts("project")
    return {
        "total": len(rows),
        "projectCount": len(by_project),
        "byFreezer": counts("freezer"),
        "byProject": by_project,  # all projects (frontend slices for the chart)
        "byType": counts("type", 8),
    }


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
    format: str = Query("json", pattern="^(json|xlsx|csv)$"),
):
    """Legacy search_box_number: locations + example tubes for a box number,
    against the active feed."""
    sheet = _primary_sheet(_active_record())
    result = box_lookup.lookup_box(sheet, box)
    if format in ("xlsx", "csv"):
        columns, rows = box_lookup.to_table(result)
        return _table_response(columns, rows, f"box_{result['box']}_lookup", format)
    return result


@router.get("/qc-sample")
def qc_sample_route(
    project: str = Query(..., min_length=1),
    boxes: str = Query(..., min_length=1),
    per_box: int = Query(5, ge=1),
    seed: int | None = Query(None),
    preferred_freezer: str | None = Query(None),
    location_overrides: str | None = Query(None),
    format: str = Query("json", pattern="^(json|xlsx|csv)$"),
):
    """Legacy make_project_box_qc_list: seeded random QC sample per box."""
    import random as _random

    box_list = qc.parse_boxes(boxes)
    if not box_list:
        raise HTTPException(status_code=400, detail="No valid box numbers")
    used_seed = seed if seed is not None else _random.randrange(1, 2**31)
    parsed_overrides: dict[str, dict] | None = None
    if location_overrides:
        try:
            parsed = json.loads(location_overrides)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Invalid location_overrides JSON") from exc
        if not isinstance(parsed, dict):
            raise HTTPException(status_code=400, detail="location_overrides must be an object")
        parsed_overrides = {
            str(box): value for box, value in parsed.items() if isinstance(value, dict)
        }

    sheet = _primary_sheet(_active_record())
    result = qc.qc_sample(
        sheet,
        project,
        box_list,
        per_box,
        used_seed,
        preferred_freezer=preferred_freezer,
        location_overrides=parsed_overrides,
    )
    if format in ("xlsx", "csv"):
        return _table_response(
            result["columns"], result["rows"], f"qc_{project}_seed{used_seed}", format
        )
    return result


def _drop_empty_columns(
    columns: list[str], rows: list[list]
) -> tuple[list[str], list[list]]:
    """Drop columns that are blank in every row (an all-empty column is noise)."""
    if not rows:
        return columns, rows
    keep = [
        i
        for i in range(len(columns))
        if any(r[i] is not None and str(r[i]).strip() != "" for r in rows)
    ]
    return [columns[i] for i in keep], [[r[i] for i in keep] for r in rows]


@router.get("/aliquot-finder")
def aliquot_finder_route(
    ids: str = Query(..., min_length=1),
    preferred_freezer: str | None = Query(None),
    backups: int = Query(3, ge=0),
    filters: str | None = Query(None),
    match: str = Query("all", pattern="^(all|any)$"),
    format: str = Query("json", pattern="^(json|xlsx|csv)$"),
):
    """Legacy find_person_aliquots: PRIMARY + BACKUP picks per person.
    `ids` is newline-delimited (project, project_id) pairs (tab/2+ spaces
    between the two cells); prefer a freezer; all-empty columns are dropped."""
    pairs = aliquot.parse_pairs(ids)
    if not pairs:
        raise HTTPException(status_code=400, detail="No ids provided")
    parsed_filters: list[dict] | None = None
    if filters:
        try:
            parsed = json.loads(filters)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Invalid filters JSON") from exc
        if not isinstance(parsed, list):
            raise HTTPException(status_code=400, detail="filters must be a JSON array")
        parsed_filters = [item for item in parsed if isinstance(item, dict)]
    sheet = _primary_sheet(_active_record())
    result = aliquot.find_aliquots(
        sheet,
        pairs,
        preferred_freezer,
        backups,
        filters=parsed_filters,
        match_mode=match,
    )
    columns, rows = _drop_empty_columns(result["columns"], result["rows"])
    if format in ("xlsx", "csv"):
        return _table_response(columns, rows, "aliquot_finder", format)
    return {"columns": columns, "rows": rows}


_SCAN_CATEGORIES = [
    "scan_not_in_database", "wrong_location", "database_not_in_scan",
    "position_conflicts", "duplicate_scan_tubecodes",
]

# wrong_location stores the scanned location under bare keys (DB location uses
# expected_*); relabel them so the exported sheet is unambiguous.
_SCAN_SCANNED_LABELS = {
    "box": "scanned_box",
    "position": "scanned_position",
    "project": "scanned_project",
}


@router.post("/scan-reconcile")
async def scan_reconcile_route(
    files: list[UploadFile] = File(...),
    format: str = Form("json"),
):
    """Legacy compare_scan_to_database: reconcile scan files vs the active feed."""
    db = _primary_sheet(_active_record())

    by_file: dict[str, list[dict]] = {}
    errors: list[dict] = []
    for f in files:
        data = await f.read()
        name = f.filename or "scan"
        try:
            by_file[name] = scan.parse_scan(name, data)
        except Exception as exc:  # noqa: BLE001
            errors.append({"file": name, "error": str(exc)})

    if not any(by_file.values()):
        raise HTTPException(status_code=422, detail="No readable scan data in the files")

    dedup = scan.dedup_files(by_file)
    records = [r for fn in dedup["kept"] for r in by_file[fn]]
    result = scan.reconcile(db, records)
    result["fileSummary"] = dedup["summary"]
    result["fileErrors"] = errors
    result["databaseColumns"] = db["columns"]
    result["scan_not_in_database_review"] = scan.build_missing_box_review(
        db, result["scan_not_in_database"]
    )
    result["wrong_location_review"] = scan.build_wrong_location_review(
        db, result["wrong_location"]
    )

    if format == "xlsx":
        sheets: dict[str, tuple[list[str], list[list]]] = {}
        for cat in _SCAN_CATEGORIES:
            rows = result[cat]
            if cat == "wrong_location":
                # scanned location is stored under bare box/position/project;
                # label it explicitly so the sheet reads scanned_* vs expected_*.
                rows = [
                    {_SCAN_SCANNED_LABELS.get(k, k): v for k, v in r.items()}
                    for r in rows
                ]
            sheets[cat] = export.dicts_to_table(rows)
        sheets["file_summary"] = export.dicts_to_table(result["fileSummary"])
        return _xlsx_response_multi(sheets, "scan_reconcile")
    return result


def _xlsx_response_multi(sheets: dict, filename: str) -> Response:
    data = export.build_multi_xlsx(sheets)
    fname = quote(f"{filename}.xlsx")
    return Response(
        content=data,
        media_type=_XLSX_MIME,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{fname}"},
    )


@router.get("/files/{file_id}/export")
def export_rows(
    file_id: int,
    q: str = Query(""),
    filters: str = Query(""),
    match: str = Query("all", pattern="^(all|any)$"),
    sort: str | None = Query(None),
    dir: str = Query("asc"),
    columns: str = Query("", description="comma-separated column subset/order"),
    fmt: str = Query("xlsx", pattern="^(xlsx|csv)$"),
):
    """Export the current filtered + sorted view as an .xlsx or .csv download."""
    record = _get_record(file_id)
    sheet = _primary_sheet(record)
    all_columns, rows, _ = _query_rows(sheet, q, filters, match, sort, dir)

    selected = [c for c in columns.split(",") if c in all_columns] or all_columns
    idx = [all_columns.index(c) for c in selected]
    out_rows = [[r[i] for i in idx] for r in rows]

    stem = Path(record.original_filename).stem
    return _table_response(selected, out_rows, f"{stem}_export", fmt)
