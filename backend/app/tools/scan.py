"""Scan-to-database reconciliation (legacy: compare_scan_to_database).

Parse physical-rack scan exports (.csv/.xlsx/.xls), de-duplicate repeated scan
files, and reconcile against the active feed. Matching is by tube_code only: a
scanned tube is correct if its code is in the active feed, otherwise it is
flagged "scanned, not in database". Rack/box/position are recorded but not used
to match.
"""
from __future__ import annotations

import csv
import io
import re
from pathlib import Path

from ..normalize import normalize_position

# Header aliases (compared lowercased, non-alphanumeric stripped).
_ALIASES = {
    "rackid": "rackid",
    "rack": "rackid",
    "tubecode": "tubecode",
    "barcode": "tubecode",
    "code": "tubecode",
    "tube": "tubecode",
    "position": "position",
    "pos": "position",
    "locationrow": "row",
    "row": "row",
    "locationcolumn": "col",
    "column": "col",
    "col": "col",
}

INVALID_CODES = {"", "noread", "notube", "na", "none", "empty", "nan"}
_RACK_RE = re.compile(r"(\d+)\s*box\s*(\d+)", re.IGNORECASE)


def _key(h: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(h).lower())


def _alias(h: str) -> str | None:
    return _ALIASES.get(_key(h))


def _read_table(filename: str, data: bytes) -> list[list]:
    ext = Path(filename).suffix.lower()
    if ext == ".csv":
        text = data.decode("utf-8-sig", errors="replace")
        return [r for r in csv.reader(io.StringIO(text))]
    if ext == ".xls":
        import xlrd

        book = xlrd.open_workbook(file_contents=data)
        sh = book.sheet_by_index(0)
        return [[sh.cell_value(r, c) for c in range(sh.ncols)] for r in range(sh.nrows)]
    # .xlsx / .xlsm
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    wb.close()
    return rows


def _project_box(rackid: str) -> tuple[str, str]:
    m = _RACK_RE.search(str(rackid or ""))
    if m:
        return f"L{int(m.group(1))}", str(int(m.group(2)))
    return "", ""


def parse_scan(filename: str, data: bytes) -> list[dict]:
    """Return scan records: {tube_code, project, box, position, source}."""
    table = _read_table(filename, data)
    if not table:
        return []
    header = table[0]
    col = {}
    for i, h in enumerate(header):
        a = _alias(h)
        if a and a not in col:
            col[a] = i

    records: list[dict] = []
    for row in table[1:]:
        def get(name):
            i = col.get(name)
            return row[i] if i is not None and i < len(row) else None

        raw_code = get("tubecode")
        code = "" if raw_code is None else str(raw_code).strip()
        rackid = get("rackid")
        project, box = _project_box(rackid)
        if get("position") is not None and str(get("position")).strip():
            position = normalize_position(get("position"))
        else:
            r, c = get("row"), get("col")
            position = normalize_position(f"{str(r or '').strip()}{str(c or '').strip()}")
        records.append(
            {
                "tube_code": code,
                "project": project,
                "box": box,
                "position": position or "",
                "source": filename,
            }
        )
    return records


def is_valid_code(code: str) -> bool:
    return _key(code) not in INVALID_CODES


def dedup_files(by_file: dict[str, list[dict]]) -> dict:
    """Group files whose readable codes overlap >= 80%; keep the richest per group."""
    files = list(by_file)
    code_sets = {
        f: {r["tube_code"].upper() for r in recs if is_valid_code(r["tube_code"])}
        for f, recs in by_file.items()
    }

    parent = {f: f for f in files}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for i in range(len(files)):
        for j in range(i + 1, len(files)):
            a, b = files[i], files[j]
            sa, sb = code_sets[a], code_sets[b]
            if sa and sb:
                overlap = len(sa & sb) / min(len(sa), len(sb))
                if overlap >= 0.8:
                    parent[find(a)] = find(b)

    groups: dict[str, list[str]] = {}
    for f in files:
        groups.setdefault(find(f), []).append(f)

    kept, summary = [], []
    for members in groups.values():
        best = max(members, key=lambda f: len(code_sets[f]))
        for f in members:
            keep = f == best
            if keep:
                kept.append(f)
            summary.append(
                {
                    "file": f,
                    "readable": len(code_sets[f]),
                    "status": "kept" if keep else "drop_duplicate",
                }
            )
    return {"kept": kept, "summary": summary}


def reconcile(db_sheet: dict, records: list[dict]) -> dict:
    """Categorize scan records against the database by tube_code only.

    A scanned tube is correct if its code (the DB `cryobank` column) exists in
    the active feed; the scanned rack/box/position are not used for matching.
    The location-based categories (wrong_location, position_conflicts,
    database_not_in_scan) are kept as empty lists for output/export/UI
    compatibility.
    """
    cols = db_sheet["columns"]
    idx = {c: i for i, c in enumerate(cols)}
    cb_i = idx.get("cryobank")

    db_codes: set[str] = set()
    for r in db_sheet["rows"]:
        if cb_i is not None and r[cb_i]:
            db_codes.add(str(r[cb_i]).strip().upper())

    out = {
        "scan_not_in_database": [],
        "wrong_location": [],
        "database_not_in_scan": [],
        "position_conflicts": [],
        "duplicate_scan_tubecodes": [],
        "correct_matches": 0,
    }

    seen_codes: dict[str, int] = {}
    valid = [r for r in records if is_valid_code(r["tube_code"])]
    for rec in valid:
        code = rec["tube_code"].upper()
        seen_codes[code] = seen_codes.get(code, 0) + 1
        if code in db_codes:
            out["correct_matches"] += 1
        else:
            out["scan_not_in_database"].append(rec)

    out["duplicate_scan_tubecodes"] = [
        {"tube_code": c, "count": n} for c, n in seen_codes.items() if n > 1
    ]
    return out


def build_missing_box_review(db_sheet: dict, missing_records: list[dict]) -> list[dict]:
    """Return full-database rows for each missing scanned tube's box, plus helpers."""
    columns = db_sheet["columns"]
    idx = {c: i for i, c in enumerate(columns)}
    proj_i, box_i = idx.get("project"), idx.get("box")

    def db_row_dict(row: list) -> dict:
        return {column: row[i] if i < len(row) else None for i, column in enumerate(columns)}

    out: list[dict] = []
    for rec_i, rec in enumerate(missing_records):
        candidates = [
            row
            for row in db_sheet["rows"]
            if proj_i is not None
            and box_i is not None
            and str(row[proj_i]).strip() == str(rec.get("project", "")).strip()
            and str(row[box_i]).strip() == str(rec.get("box", "")).strip()
        ]
        if not candidates:
            blank = {column: None for column in columns}
            out.append(
                {
                    **blank,
                    "review_id": f"missing-{rec_i}-0",
                    "scanned_tube_code": rec.get("tube_code"),
                    "scanned_project": rec.get("project"),
                    "scanned_box": rec.get("box"),
                    "scanned_position": rec.get("position"),
                    "scanned_source": rec.get("source"),
                }
            )
            continue
        for row_i, row in enumerate(candidates):
            out.append(
                {
                    **db_row_dict(row),
                    "review_id": f"missing-{rec_i}-{row_i}",
                    "scanned_tube_code": rec.get("tube_code"),
                    "scanned_project": rec.get("project"),
                    "scanned_box": rec.get("box"),
                    "scanned_position": rec.get("position"),
                    "scanned_source": rec.get("source"),
                }
            )
    return out


def build_wrong_location_review(db_sheet: dict, wrong_rows: list[dict]) -> list[dict]:
    """Return full-database rows with scanned-location helpers for wrong-location fixes."""
    columns = db_sheet["columns"]
    idx = {c: i for i, c in enumerate(columns)}
    record_i = idx.get("record_id")

    def db_row_dict(row: list) -> dict:
        return {column: row[i] if i < len(row) else None for i, column in enumerate(columns)}

    by_record = {}
    for row in db_sheet["rows"]:
        if record_i is not None and record_i < len(row):
            by_record[str(row[record_i])] = row

    out: list[dict] = []
    for i, item in enumerate(wrong_rows):
        row = by_record.get(str(item.get("record_id", "")))
        if row is None:
            continue
        out.append(
            {
                **db_row_dict(row),
                "review_id": f"wrong-{i}",
                "scanned_box": item.get("box"),
                "scanned_position": item.get("position"),
                "scanned_source": item.get("source"),
            }
        )
    return out
