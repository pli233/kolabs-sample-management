"""Random QC sampling (legacy: make_project_box_qc_list).

For a project and a set of boxes, randomly pick N tubes per box. Reproducible
via a seed; each box uses an independent sub-seed so boxes don't influence each
other.
"""
from __future__ import annotations

import random

from ..normalize import normalize_box
from .common import is_tube


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
) -> dict:
    """Return sampled tube rows (full columns) plus per-box counts."""
    columns: list[str] = sheet["columns"]
    rows: list[list] = sheet["rows"]
    idx = {c: i for i, c in enumerate(columns)}
    proj_i, box_i = idx.get("project"), idx.get("box")
    proj_target = project.strip().lower()

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
        rng = random.Random(f"{seed}-{box}")
        take = candidates if len(candidates) <= per_box else rng.sample(candidates, per_box)
        sampled.extend(take)
        per_box_counts.append(
            {"box": box, "available": len(candidates), "sampled": len(take)}
        )

    return {
        "project": project,
        "seed": seed,
        "perBox": per_box,
        "boxes": per_box_counts,
        "columns": columns,
        "rows": sampled,
    }
