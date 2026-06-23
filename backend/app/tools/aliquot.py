"""Per-person aliquot finder (legacy: find_person_aliquots).

For each person/project_id, recommend one PRIMARY tube from the easiest-to-reach
freezer (the one with the most aliquots, or a preferred one), plus N BACKUP tubes.
"""
from __future__ import annotations

import re
from collections import defaultdict

from .common import is_tube

OUTPUT_COLS = [
    "input_id", "matched_project_id", "choice", "choice_rank",
    "selected_freezer", "selected_freezer_count", "total_count",
    "project", "freezer", "rack", "drawer", "box_pos", "box",
    "sample_pos", "aliquot", "cryobank", "track_id", "record_id", "note",
]

_SPLIT = re.compile(r"[\s,;]+")


def parse_ids(text: str) -> list[str]:
    out, seen = [], set()
    for tok in _SPLIT.split(text or ""):
        t = tok.strip()
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return out


def _matches(rows: list[list], proj_i: int, idx: dict, person_id: str) -> list[list]:
    pid = person_id.strip()
    prefix = pid + "."
    result = []
    for r in rows:
        val = str(r[proj_i]).strip()
        if "." in pid:
            hit = val == pid
        else:
            hit = val == pid or val.startswith(prefix)
        if hit and is_tube(r, idx):
            result.append(r)
    return result


def find_aliquots(
    sheet: dict,
    ids: list[str],
    preferred_freezer: str | None,
    backups: int,
    preferred_project: str | None = None,
) -> dict:
    columns: list[str] = sheet["columns"]
    rows: list[list] = sheet["rows"]
    idx = {c: i for i, c in enumerate(columns)}
    proj_i = idx.get("project_id")
    fr_i = idx.get("freezer")
    pref = (preferred_freezer or "").strip()
    pref_proj = (preferred_project or "").strip()

    def cell(row, col):
        return row[idx[col]] if col in idx else None

    out: list[list] = []
    for person in ids:
        if proj_i is None:
            out.append(_not_found(person, "No project_id column"))
            continue
        matched = _matches(rows, proj_i, idx, person)
        if not matched:
            out.append(_not_found(person, "No match in active feed"))
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
        if pref_proj and pref_proj not in {
            str(cell(r, "project") or "").strip() for r in matched
        }:
            note_parts.append(f"Preferred project {pref_proj} had no samples")

        # Order candidates: preferred project first, then the chosen freezer,
        # then by freezer abundance (stable tiebreak for reproducibility).
        def sort_key(r):
            proj = str(cell(r, "project") or "").strip()
            frz = str(r[fr_i]).strip() if fr_i is not None else ""
            return (
                0 if pref_proj and proj == pref_proj else 1,
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
                    person, matched_pid,
                    "PRIMARY" if rank == 1 else "BACKUP", rank,
                    primary_frz, counts.get(primary_frz, 0), total,
                    cell(r, "project"), cell(r, "freezer"), cell(r, "rack"),
                    cell(r, "drawer"), cell(r, "box_pos"), cell(r, "box"),
                    cell(r, "sample_pos"), cell(r, "aliquot"), cell(r, "cryobank"),
                    cell(r, "track_id"), cell(r, "record_id"),
                    note if rank == 1 else "",
                ]
            )

    return {"columns": OUTPUT_COLS, "rows": out}


def _not_found(person: str, note: str) -> list:
    row = [person, "", "NOT FOUND", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", note]
    return row
