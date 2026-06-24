"""Per-person aliquot finder (legacy: find_person_aliquots).

For each person/project_id, recommend one PRIMARY tube from the easiest-to-reach
freezer (the one with the most aliquots, or a preferred one), plus N BACKUP tubes.
"""
from __future__ import annotations

import re
from collections import defaultdict

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
) -> dict:
    columns: list[str] = sheet["columns"]
    rows: list[list] = sheet["rows"]
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
            out.append(_not_found(person, project, f"No match for {label}"))
            continue

        by_freezer: dict[str, list] = defaultdict(list)
        for r in matched:
            by_freezer[str(r[fr_i]).strip() if fr_i is not None else ""].append(r)
        counts = {f: len(v) for f, v in by_freezer.items()}
        total = len(matched)

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

        ordered = sorted(matched, key=sort_key)
        primary_frz = str(ordered[0][fr_i]).strip() if fr_i is not None else ""
        note = "; ".join(note_parts)
        matched_pid = str(matched[0][proj_i]).strip()
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
                ]
            )

    return {"columns": OUTPUT_COLS, "rows": out}


def _not_found(person: str, project: str | None, note: str) -> list:
    # input_id, input_project, matched_project_id, choice, …blanks…, note
    return [person, project or "", "", "NOT FOUND",
            *[""] * (len(OUTPUT_COLS) - 5), note]
