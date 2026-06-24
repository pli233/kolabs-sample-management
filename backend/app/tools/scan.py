"""Scan-to-database reconciliation (legacy: compare_scan_to_database).

Parse physical-rack scan exports (.csv/.xlsx/.xls), de-duplicate repeated scan
files, and reconcile against the active feed: wrong codes, wrong locations,
missing tubes, and position conflicts.
"""
from __future__ import annotations

import csv
import io
import re
from pathlib import Path

from ..normalize import normalize_box, normalize_position

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
    """Categorize scan records against the database sheet."""
    cols = db_sheet["columns"]
    idx = {c: i for i, c in enumerate(cols)}
    rows = db_sheet["rows"]
    cb_i, pr_i, bx_i, sp_i = (
        idx.get("cryobank"), idx.get("project"), idx.get("box"), idx.get("sample_pos")
    )
    rec_i = idx.get("record_id")

    db_by_code: dict[str, list[dict]] = {}
    db_by_pos: dict[tuple, list[str]] = {}
    db_by_box: dict[tuple, set] = {}
    for r in rows:
        code = str(r[cb_i]).strip().upper() if cb_i is not None and r[cb_i] else ""
        proj = str(r[pr_i]).strip() if pr_i is not None and r[pr_i] else ""
        box = normalize_box(r[bx_i]) if bx_i is not None else None
        pos = normalize_position(r[sp_i]) if sp_i is not None else None
        loc = {"project": proj, "box": box, "position": pos,
               "record_id": r[rec_i] if rec_i is not None else None}
        if code:
            # full DB record so wrong_location rows can show every column
            loc["record"] = dict(zip(cols, r))
            db_by_code.setdefault(code, []).append(loc)
            if box is not None:
                db_by_box.setdefault((proj, box), set()).add(code)
        if box is not None and pos:
            db_by_pos.setdefault((proj, box, pos), []).append(code)

    out = {
        "scan_not_in_database": [],
        "wrong_location": [],
        "database_not_in_scan": [],
        "position_conflicts": [],
        "duplicate_scan_tubecodes": [],
        "correct_matches": 0,
    }

    seen_codes: dict[str, int] = {}
    scanned_box_codes: dict[tuple, set] = {}
    valid = [r for r in records if is_valid_code(r["tube_code"])]

    for rec in valid:
        code = rec["tube_code"].upper()
        seen_codes[code] = seen_codes.get(code, 0) + 1
        s_proj, s_box, s_pos = rec["project"], rec["box"], rec["position"]
        s_boxn = normalize_box(s_box)
        if s_boxn is not None:
            scanned_box_codes.setdefault((s_proj, s_boxn), set()).add(code)

        db_locs = db_by_code.get(code)
        if not db_locs:
            out["scan_not_in_database"].append(rec)
            continue
        match = any(
            loc["project"] == s_proj and loc["box"] == s_boxn and loc["position"] == s_pos
            for loc in db_locs
        )
        if match:
            out["correct_matches"] += 1
        else:
            exp = db_locs[0]
            # full DB record first, then scanned values (rec) win for the
            # blue box/position/project columns, then the red "expected" fields.
            out["wrong_location"].append(
                {**exp.get("record", {}), **rec,
                 "expected_project": exp["project"],
                 "expected_box": exp["box"], "expected_position": exp["position"],
                 "record_id": exp["record_id"]}
            )
        # position conflict: DB assigns this slot to a different code
        owners = db_by_pos.get((s_proj, s_boxn, s_pos), [])
        if owners and code not in [o.upper() for o in owners]:
            out["position_conflicts"].append(
                {**rec, "db_codes_at_position": ", ".join(owners)}
            )

    # database tubes expected in a scanned box but not scanned — attach the
    # full DB record (these tubes are in the database) like wrong_location does.
    for (proj, box), scanned in scanned_box_codes.items():
        for code in db_by_box.get((proj, box), set()):
            if code not in scanned:
                loc = next(
                    (l for l in db_by_code.get(code, [])
                     if l["project"] == proj and l["box"] == box),
                    None,
                )
                out["database_not_in_scan"].append(
                    {**(loc.get("record") if loc else {}),
                     "tube_code": code, "project": proj, "box": box}
                )

    out["duplicate_scan_tubecodes"] = [
        {"tube_code": c, "count": n} for c, n in seen_codes.items() if n > 1
    ]
    return out
