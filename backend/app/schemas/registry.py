"""Extensible registry of fixed-column schemas.

Only ``main_library`` is registered this iteration. Adding a new file type later
means registering another ``SchemaDef`` here — matching and validation are generic.
"""
from __future__ import annotations

from dataclasses import dataclass

from .main_library import MAIN_LIBRARY_COLUMNS, MAIN_LIBRARY_NAME


@dataclass(frozen=True)
class SchemaDef:
    name: str
    columns: list[str]


_REGISTRY: list[SchemaDef] = [
    SchemaDef(name=MAIN_LIBRARY_NAME, columns=MAIN_LIBRARY_COLUMNS),
]


def _normalize_header(header: list[str]) -> list[str]:
    return [str(h).strip() for h in header if h is not None and str(h).strip() != ""]


def match(header: list[str]) -> str | None:
    """Return the schema name whose column *set* equals the header, else None."""
    clean = set(_normalize_header(header))
    for schema in _REGISTRY:
        if set(schema.columns) == clean:
            return schema.name
    return None


# A sheet is treated as "meant to be" a schema (and so worth flagging column
# problems on) when it shares at least this fraction of the schema's columns.
# Below it, the sheet is considered an unrelated / auxiliary sheet, not an error.
COVERAGE_THRESHOLD = 0.6


def classify(header: list[str]) -> tuple[str, str | None, list[dict]]:
    """Classify a header against the registry.

    Returns ``(status, schema_name, issues)`` where status is:
    - ``"matched"`` — conforms exactly to a schema (issues empty)
    - ``"partial"`` — resembles a schema (>= COVERAGE_THRESHOLD) but has column
      problems; issues lists what's missing/extra/misordered
    - ``"other"`` — doesn't resemble any schema; an auxiliary/unknown sheet
    """
    clean = _normalize_header(header)
    if not clean:
        return ("other", None, [])

    clean_set = set(clean)
    best_schema = None
    best_coverage = -1.0
    for schema in _REGISTRY:
        expected_set = set(schema.columns)
        coverage = len(expected_set & clean_set) / len(expected_set)
        if coverage > best_coverage:
            best_coverage, best_schema = coverage, schema

    assert best_schema is not None  # registry is never empty
    issues = validate(best_schema.name, clean)
    if not issues:
        return ("matched", best_schema.name, [])
    if best_coverage >= COVERAGE_THRESHOLD:
        return ("partial", best_schema.name, issues)
    return ("other", None, [])


def validate(name: str, header: list[str]) -> list[dict]:
    """Compare a header against a named schema.

    Returns a list of issues: ``{"type": "missing|extra|order", "column": str}``.
    An empty list means the header matches the schema exactly (names and order).
    """
    schema = next((s for s in _REGISTRY if s.name == name), None)
    if schema is None:
        return [{"type": "unknown_schema", "column": name}]

    clean = _normalize_header(header)
    expected = schema.columns
    clean_set, expected_set = set(clean), set(expected)

    issues: list[dict] = []
    for col in expected:
        if col not in clean_set:
            issues.append({"type": "missing", "column": col})
    for col in clean:
        if col not in expected_set:
            issues.append({"type": "extra", "column": col})
    # Order only matters when the column sets already match.
    if clean_set == expected_set and clean != expected:
        for col in clean:
            if clean.index(col) != expected.index(col):
                issues.append({"type": "order", "column": col})
    return issues
