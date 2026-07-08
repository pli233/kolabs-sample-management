"""Random QC sampling (legacy: make_project_box_qc_list).

For a project and a set of boxes, randomly pick N tubes per box. Reproducible
via a seed; each box uses an independent sub-seed so boxes don't influence each
other.
"""
from __future__ import annotations

import random

from ..normalize import normalize_box
from .common import is_tube

LOCATION_COLS = ["freezer", "shelf", "rack", "drawer", "box_pos"]


def parse_boxes(spec: str) -> list[str]:
    """Expand '716-719,722' -> ['716','717','718','719','722'] (deduped, ordered)."""
    out: list[str] = []
    seen: set[str] = set()
    for part in spec.replace(" ", "").split(","):
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            try:
                lo, hi = int(a), int(b)
            except ValueError:
                continue
            for n in range(min(lo, hi), max(lo, hi) + 1):
                key = str(n)
                if key not in seen:
                    seen.add(key)
                    out.append(key)
        else:
            key = normalize_box(part) or part
            if key not in seen:
                seen.add(key)
                out.append(key)
    return out


def qc_sample(
    sheet: dict,
    project: str,
    boxes: list[str],
    per_box: int,
    seed: int,
    preferred_freezer: str | None = None,
    location_overrides: dict[str, dict] | None = None,
) -> dict:
    """Return sampled tube rows plus per-box summary metadata.

    Ambiguous box locations no longer block sampling. We sample from all rows in
    the box, optionally narrowed by preferred freezer when it yields matches.
    """
    columns: list[str] = sheet["columns"]
    rows: list[list] = sheet["rows"]
    idx = {c: i for i, c in enumerate(columns)}
    proj_i, box_i = idx.get("project"), idx.get("box")
    proj_target = project.strip().lower()
    preferred = (preferred_freezer or "").strip()
    overrides = location_overrides or {}

    def cell(row: list, column: str):
        i = idx.get(column)
        return row[i] if i is not None and i < len(row) else None

    def freezer_value(row: list) -> str:
        value = cell(row, "freezer")
        return "" if value is None else str(value).strip()

    def location_key(row: list) -> tuple:
        return tuple(cell(row, column) for column in LOCATION_COLS)

    def location_payload(rows_for_location: list[list]) -> dict:
        first = rows_for_location[0]
        return {
            "location": {column: cell(first, column) for column in LOCATION_COLS},
            "count": len(rows_for_location),
        }

    sampled: list[list] = []
    per_box_counts: list[dict] = []
    for box in boxes:
        box_target = normalize_box(box)
        candidates = [
            r
            for r in rows
            if proj_i is not None
            and box_i is not None
            and str(r[proj_i]).strip().lower() == proj_target
            and normalize_box(r[box_i]) == box_target
            and is_tube(r, idx)
        ]
        grouped: dict[tuple, list[list]] = {}
        for row in candidates:
            grouped.setdefault(location_key(row), []).append(row)

        locations = list(grouped.values())
        status = "ok"
        chosen_rows = candidates
        if preferred:
            preferred_rows = [
                row for row in candidates
                if freezer_value(row).lower() == preferred.lower()
            ]
            if preferred_rows:
                chosen_rows = preferred_rows
                status = "resolved_by_preferred_freezer"

        rng = random.Random(f"{seed}-{box}")
        take = (
            chosen_rows
            if len(chosen_rows) <= per_box
            else rng.sample(chosen_rows, per_box)
        )
        sampled.extend(take)

        summary = {
            "box": box,
            "available": len(candidates),
            "sampled": len(take),
            "status": status,
            "locationCount": len(locations),
        }
        if len(locations) == 1:
            summary["location"] = location_payload(locations[0])["location"]
        per_box_counts.append(summary)

    return {
        "project": project,
        "seed": seed,
        "perBox": per_box,
        "preferredFreezer": preferred or None,
        "locationColumns": LOCATION_COLS,
        "boxes": per_box_counts,
        "ambiguousBoxes": [],
        "columns": columns,
        "rows": sampled,
    }
