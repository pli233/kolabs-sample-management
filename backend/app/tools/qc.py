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
    """Return sampled tube rows plus per-box resolution/ambiguity metadata."""
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

    def location_matches(row: list, target: dict) -> bool:
        return all(cell(row, column) == target.get(column) for column in LOCATION_COLS)

    sampled: list[list] = []
    per_box_counts: list[dict] = []
    ambiguous_boxes: list[dict] = []
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
        chosen_rows: list[list] | None = None
        status = "ok"
        box_override = overrides.get(box)

        if box_override:
            override_matches = [
                location_rows
                for location_rows in locations
                if location_matches(location_rows[0], box_override)
            ]
            if len(override_matches) == 1:
                chosen_rows = override_matches[0]
                status = "resolved_by_location_override"
            else:
                status = "location_override_no_match"
        elif len(locations) == 1:
            chosen_rows = locations[0]
        elif len(locations) > 1 and preferred:
            preferred_locations = [
                location_rows
                for location_rows in locations
                if freezer_value(location_rows[0]).lower() == preferred.lower()
            ]
            if len(preferred_locations) == 1:
                chosen_rows = preferred_locations[0]
                status = "resolved_by_preferred_freezer"
            elif len(preferred_locations) > 1:
                status = "ambiguous_in_preferred_freezer"
            else:
                status = "preferred_freezer_no_match"
        elif len(locations) > 1:
            status = "ambiguous"

        take: list[list] = []
        if chosen_rows is not None:
            rng = random.Random(f"{seed}-{box}")
            take = (
                chosen_rows
                if len(chosen_rows) <= per_box
                else rng.sample(chosen_rows, per_box)
            )
            sampled.extend(take)
        else:
            ambiguous_boxes.append(
                {
                    "box": box,
                    "status": status,
                    "preferred_freezer": preferred or None,
                    "selected_location": box_override,
                    "locations": [
                        location_payload(location_rows)
                        for location_rows in sorted(
                            locations,
                            key=lambda item: repr(location_key(item[0])),
                        )
                    ],
                }
            )

        summary = {
            "box": box,
            "available": len(candidates),
            "sampled": len(take),
            "status": status,
        }
        if chosen_rows is not None:
            summary["location"] = location_payload(chosen_rows)["location"]
            summary["locationCount"] = 1
        else:
            summary["locationCount"] = len(locations)
        per_box_counts.append(summary)

    return {
        "project": project,
        "seed": seed,
        "perBox": per_box,
        "preferredFreezer": preferred or None,
        "locationColumns": LOCATION_COLS,
        "boxes": per_box_counts,
        "ambiguousBoxes": ambiguous_boxes,
        "columns": columns,
        "rows": sampled,
    }
