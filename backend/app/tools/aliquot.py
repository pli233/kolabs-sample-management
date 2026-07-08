"""Per-person aliquot finder (legacy: find_person_aliquots).

For each person/project_id, recommend one PRIMARY tube from the easiest-to-reach
freezer (the one with the most aliquots, or a preferred one), plus N BACKUP tubes.
"""
from __future__ import annotations

import re
from collections import defaultdict

from ..normalize import normalizer_for
from .common import is_tube

OUTPUT_COLS = [
    "input_id", "input_project", "matched_project_id", "choice", "choice_rank",
    "selected_freezer", "selected_freezer_count", "total_count",
    "project", "freezer", "rack", "drawer", "box_pos", "box",
    "sample_pos", "aliquot", "volume_ul", "cryobank", "track_id", "record_id",
    "note",
]

# A line is one (project, project_id) pair: Excel "copy two columns" puts a TAB
# between cells, so split on a tab or 2+ spaces. A single token = project_id
# with no project (preserves the old single-column behaviour).
_CELL = re.compile(r"\t+| {2,}")


def _cell_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    return str(value)


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
        if _is_blank(value):
            return False
        return {
            "gt": text > t,
            "lt": text < t,
            "gte": text >= t,
            "lte": text <= t,
        }[op]
    return True


def _row_matches_filters(
    row: list,
    idx: dict[str, int],
    filters: list[dict] | None,
    match_mode: str,
) -> bool:
    active = []
    for condition in filters or []:
        column = condition.get("column")
        op = condition.get("op")
        if column not in idx or not op:
            continue
        value = condition.get("value", "")
        if op not in ("is_empty", "not_empty") and str(value).strip() == "":
            continue
        active.append(condition)

    if not active:
        return True

    checks = [
        _apply_condition(
            row[idx[condition["column"]]],
            condition["op"],
            str(condition.get("value", "")),
            normalizer_for(condition["column"]),
        )
        for condition in active
    ]
    return any(checks) if match_mode == "any" else all(checks)


def _output_columns(source_columns: list[str]) -> list[str]:
    return OUTPUT_COLS + [column for column in source_columns if column not in OUTPUT_COLS]


def parse_pairs(text: str) -> list[tuple[str | None, str]]:
    out: list[tuple[str | None, str]] = []
    seen: set[tuple[str | None, str]] = set()
    for line in (text or "").splitlines():
        cells = [c.strip() for c in _CELL.split(line.strip()) if c.strip()]
        if not cells:
            continue
        if len(cells) == 1:
            pair: tuple[str | None, str] = (None, cells[0])
        else:
            pair = (cells[0], cells[1])  # project, project_id
        if pair not in seen:
            seen.add(pair)
            out.append(pair)
    return out


def _matches(
    rows: list[list], proj_i: int, idx: dict, project: str | None, person_id: str
) -> list[list]:
    pid = person_id.strip()
    prefix = pid + "."
    proj_col = idx.get("project")
    want_proj = (project or "").strip().casefold()
    result = []
    for r in rows:
        val = str(r[proj_i]).strip()
        if "." in pid:
            hit = val == pid
        else:
            hit = val == pid or val.startswith(prefix)
        if not hit or not is_tube(r, idx):
            continue
        # Hard filter: project_id alone is not unique, so require the project to
        # match too. A line with no project matches on project_id alone.
        if want_proj and proj_col is not None:
            if str(r[proj_col]).strip().casefold() != want_proj:
                continue
        result.append(r)
    return result


def find_aliquots(
    sheet: dict,
    pairs: list[tuple[str | None, str]],
    preferred_freezer: str | None,
    backups: int,
    filters: list[dict] | None = None,
    match_mode: str = "all",
) -> dict:
    columns: list[str] = sheet["columns"]
    rows: list[list] = sheet["rows"]
    result_columns = _output_columns(columns)
    extra_columns = [column for column in columns if column not in OUTPUT_COLS]
    idx = {c: i for i, c in enumerate(columns)}
    proj_i = idx.get("project_id")
    fr_i = idx.get("freezer")
    pref = (preferred_freezer or "").strip()

    def cell(row, col):
        return row[idx[col]] if col in idx else None

    out: list[list] = []
    for project, person in pairs:
        if proj_i is None:
            out.append(_not_found(person, project, "No project_id column"))
            continue
        matched = _matches(rows, proj_i, idx, project, person)
        if not matched:
            label = f"{project} / {person}" if project else person
            out.append(_not_found(person, project, result_columns, f"No match for {label}"))
            continue

        filtered = [
            row
            for row in matched
            if _row_matches_filters(row, idx, filters, match_mode)
        ]
        if not filtered:
            label = f"{project} / {person}" if project else person
            out.append(
                _not_found(
                    person,
                    project,
                    result_columns,
                    f"No filtered match for {label}",
                )
            )
            continue

        by_freezer: dict[str, list] = defaultdict(list)
        for r in filtered:
            by_freezer[str(r[fr_i]).strip() if fr_i is not None else ""].append(r)
        counts = {f: len(v) for f, v in by_freezer.items()}
        total = len(filtered)

        # Freezer preference: honour it if present, else the most-populated.
        note_parts: list[str] = []
        chosen = max(counts, key=lambda f: counts[f])
        if pref:
            if pref in by_freezer:
                chosen = pref
            else:
                note_parts.append(
                    f"Preferred freezer {pref} had no samples; used {chosen}"
                )
        # Order candidates: the chosen freezer first, then by freezer abundance
        # (stable tiebreak for reproducibility).
        def sort_key(r):
            frz = str(r[fr_i]).strip() if fr_i is not None else ""
            return (
                0 if frz == chosen else 1,
                -counts.get(frz, 0),
                frz,
            )

        ordered = sorted(filtered, key=sort_key)
        primary_frz = str(ordered[0][fr_i]).strip() if fr_i is not None else ""
        note = "; ".join(note_parts)
        matched_pid = str(filtered[0][proj_i]).strip()
        for rank, r in enumerate(ordered[: 1 + max(0, backups)], start=1):
            out.append(
                [
                    person, project or "", matched_pid,
                    "PRIMARY" if rank == 1 else "BACKUP", rank,
                    primary_frz, counts.get(primary_frz, 0), total,
                    cell(r, "project"), cell(r, "freezer"), cell(r, "rack"),
                    cell(r, "drawer"), cell(r, "box_pos"), cell(r, "box"),
                    cell(r, "sample_pos"), cell(r, "aliquot"),
                    cell(r, "volume_ul"), cell(r, "cryobank"),
                    cell(r, "track_id"), cell(r, "record_id"),
                    note if rank == 1 else "",
                    *[cell(r, column) for column in extra_columns],
                ]
            )

    return {"columns": result_columns, "rows": out}


def _not_found(person: str, project: str | None, columns: list[str], note: str) -> list:
    # Summary columns keep note in its normal slot; source-only extras stay blank.
    return [
        person,
        project or "",
        "",
        "NOT FOUND",
        *[""] * (len(OUTPUT_COLS) - 5),
        note,
        *[""] * (len(columns) - len(OUTPUT_COLS)),
    ]
