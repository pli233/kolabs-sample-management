"""Shared helpers for the legacy-tool endpoints."""
from __future__ import annotations

# A row is a real tube only if at least one of these fields is non-blank.
TUBE_FIELDS = ["sample_pos", "record_id", "cryobank", "aliquot", "track_id", "project_id"]


def blank(value) -> bool:
    return value is None or str(value).strip() == ""


def is_tube(row: list, idx: dict) -> bool:
    return any(field in idx and not blank(row[idx[field]]) for field in TUBE_FIELDS)
