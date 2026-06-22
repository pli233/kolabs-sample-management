"""Box-number lookup (legacy: search_box_number).

Given just a box number, list every unique storage location it appears in
(across projects/freezers), with a tube count and up to 2 example tubes.
"""
from __future__ import annotations

from ..normalize import normalize_box
from .common import blank as _blank
from .common import is_tube as _is_tube

# Columns that define a unique physical location.
LOCATION_COLS = ["project", "freezer", "shelf", "rack", "drawer", "box_pos", "box"]
# Detail fields shown for each example tube.
EXAMPLE_COLS = ["sample_pos", "cryobank", "aliquot", "track_id", "record_id", "project_id"]

MAX_EXAMPLES = 2


def lookup_box(sheet: dict, box: str) -> dict:
    """Group the sheet's tubes for ``box`` by unique location."""
    columns: list[str] = sheet["columns"]
    rows: list[list] = sheet["rows"]
    idx = {c: i for i, c in enumerate(columns)}
    target = normalize_box(box)

    loc_cols = [c for c in LOCATION_COLS if c in idx]
    ex_cols = [c for c in EXAMPLE_COLS if c in idx]
    box_i = idx.get("box")

    groups: dict[tuple, dict] = {}
    for row in rows:
        if box_i is None or normalize_box(row[box_i]) != target:
            continue
        if not _is_tube(row, idx):
            continue
        key = tuple(str(row[idx[c]]) if not _blank(row[idx[c]]) else "" for c in loc_cols)
        g = groups.get(key)
        if g is None:
            g = {
                "location": {c: row[idx[c]] for c in loc_cols},
                "count": 0,
                "examples": [],
            }
            groups[key] = g
        g["count"] += 1
        if len(g["examples"]) < MAX_EXAMPLES:
            g["examples"].append({c: row[idx[c]] for c in ex_cols})

    locations = sorted(
        groups.values(),
        key=lambda g: tuple(str(g["location"].get(c, "")) for c in loc_cols),
    )
    return {
        "box": target,
        "locationColumns": loc_cols,
        "exampleColumns": ex_cols,
        "locations": locations,
    }


def to_table(result: dict) -> tuple[list[str], list[list]]:
    """Flatten the lookup result to columns + rows for xlsx export."""
    loc_cols = result["locationColumns"]
    ex_cols = result["exampleColumns"]
    columns = [*loc_cols, "tube_count", *ex_cols]
    rows: list[list] = []
    for loc in result["locations"]:
        base = [loc["location"].get(c) for c in loc_cols] + [loc["count"]]
        if loc["examples"]:
            for ex in loc["examples"]:
                rows.append([*base, *[ex.get(c) for c in ex_cols]])
        else:
            rows.append([*base, *[None] * len(ex_cols)])
    return columns, rows
