"""Value normalization for matching biorepository fields.

The legacy lab tools normalized box numbers and positions before matching so
that ``0728`` ≡ ``728`` and ``a1`` ≡ ``A01``. Naive string filters miss these,
producing false-empty results. These helpers normalize both the stored cell and
the query value before comparison.

Normalizers are keyed by main_library column name; unknown columns pass through.
"""
from __future__ import annotations

import re

_POSITION_RE = re.compile(r"^([A-Za-z]+)(\d+)$")


def normalize_box(value) -> str | None:
    """Box numbers compared as integers: '0728' -> '728', 728 -> '728'."""
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    try:
        return str(int(float(text)))
    except ValueError:
        return text.lower()


def normalize_position(value) -> str | None:
    """Tube positions as letter(s) + zero-padded number: 'a1' -> 'A01'."""
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    m = _POSITION_RE.match(text)
    if m:
        letters, digits = m.group(1).upper(), m.group(2)
        return f"{letters}{int(digits):02d}"
    return text.upper()


# main_library columns that benefit from structural normalization.
COLUMN_NORMALIZERS = {
    "box": normalize_box,
    "box_pos": normalize_box,
    "sample_pos": normalize_position,
}


def normalizer_for(column: str):
    """Return the normalizer for a column, or None if it passes through."""
    return COLUMN_NORMALIZERS.get(column)


def normalize_value(column: str, value):
    """Normalize a value for the given column; pass through if no normalizer."""
    fn = COLUMN_NORMALIZERS.get(column)
    return fn(value) if fn else value
