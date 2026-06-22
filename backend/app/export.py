"""Build styled .xlsx workbooks from rows for download (legacy tools deliver xlsx)."""
from __future__ import annotations

import io
import re

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

_INVALID_SHEET = re.compile(r"[\[\]:*?/\\]")
_HEADER_FILL = PatternFill("solid", fgColor="0E8ED6")  # Kolaboratory sky blue
_HEADER_FONT = Font(bold=True, color="FFFFFF")


def _safe_sheet_name(name: str) -> str:
    cleaned = _INVALID_SHEET.sub(" ", name or "").strip()
    return (cleaned or "Export")[:31]


def build_xlsx(columns: list[str], rows: list[list], sheet_name: str = "Export") -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = _safe_sheet_name(sheet_name)

    ws.append(columns)
    for cell in ws[1]:
        cell.fill = _HEADER_FILL
        cell.font = _HEADER_FONT
        cell.alignment = Alignment(vertical="center")

    for row in rows:
        ws.append(list(row))

    ws.freeze_panes = "A2"
    if columns:
        ref = f"A1:{get_column_letter(len(columns))}{len(rows) + 1}"
        ws.auto_filter.ref = ref

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
