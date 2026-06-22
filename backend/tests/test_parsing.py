from app.parsing import parse_file
from app.schemas.main_library import MAIN_LIBRARY_COLUMNS


def test_parse_main_library_sample(sample_xlsx_path):
    sheets = parse_file(str(sample_xlsx_path), ".xlsx", max_rows=200)
    assert len(sheets) >= 1

    # The main data sheet matches the fixed schema.
    main = next(s for s in sheets if s["columns"] == list(MAIN_LIBRARY_COLUMNS))
    assert main["schemaValid"] is True
    assert main["issues"] == []
    assert len(main["rows"]) > 0
    # First data row, first cell is record_id == 1 in the sample.
    assert main["rows"][0][0] == 1

    # No fully-empty rows survive normalization.
    for s in sheets:
        for row in s["rows"]:
            assert any(cell is not None for cell in row)


def test_parse_marks_aux_sheet_invalid(sample_xlsx_path):
    sheets = parse_file(str(sample_xlsx_path), ".xlsx", max_rows=50)
    # The 7-column "Sheet1" does not match the 43-column schema.
    aux = [s for s in sheets if len(s["columns"]) == 7]
    assert aux, "expected a non-conforming auxiliary sheet"
    assert all(s["schemaValid"] is False for s in aux)


def test_rows_capped_but_total_reported(sample_xlsx_path):
    sheets = parse_file(str(sample_xlsx_path), ".xlsx", max_rows=100)
    main = next(s for s in sheets if s["columns"] == list(MAIN_LIBRARY_COLUMNS))
    assert len(main["rows"]) == 100
    assert main["rowCount"] > 100  # true total exceeds the cap
    assert main["truncated"] is True


def test_datetime_normalized_to_string(sample_xlsx_path):
    sheets = parse_file(str(sample_xlsx_path), ".xlsx", max_rows=200)
    main = next(s for s in sheets if s["columns"] == list(MAIN_LIBRARY_COLUMNS))
    date_frozen_idx = main["columns"].index("date_frozen")
    values = [r[date_frozen_idx] for r in main["rows"] if r[date_frozen_idx] is not None]
    assert values, "expected at least one date_frozen value"
    assert all(isinstance(v, str) for v in values)
