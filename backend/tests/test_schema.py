from app.schemas import registry
from app.schemas.main_library import MAIN_LIBRARY_COLUMNS


def test_match_main_library():
    assert registry.match(list(MAIN_LIBRARY_COLUMNS)) == "main_library"


def test_match_handles_whitespace_and_blanks():
    header = [" record_id ", *MAIN_LIBRARY_COLUMNS[1:], None, ""]
    assert registry.match(header) == "main_library"


def test_match_unrecognized():
    assert registry.match(["foo", "bar", "baz"]) is None


def test_validate_clean():
    assert registry.validate("main_library", list(MAIN_LIBRARY_COLUMNS)) == []


def test_validate_missing_column():
    header = list(MAIN_LIBRARY_COLUMNS)[:-1]  # drop last col
    issues = registry.validate("main_library", header)
    assert {"type": "missing", "column": "shipment_data_complete"} in issues


def test_validate_extra_column():
    header = list(MAIN_LIBRARY_COLUMNS) + ["surprise"]
    issues = registry.validate("main_library", header)
    assert {"type": "extra", "column": "surprise"} in issues


def test_classify_exact_match():
    status, schema, issues = registry.classify(list(MAIN_LIBRARY_COLUMNS))
    assert status == "matched"
    assert schema == "main_library"
    assert issues == []


def test_classify_partial_when_close_but_broken():
    # Looks like the main library but missing one column -> partial, with a why.
    header = list(MAIN_LIBRARY_COLUMNS)[:-1]
    status, schema, issues = registry.classify(header)
    assert status == "partial"
    assert schema == "main_library"
    assert {"type": "missing", "column": "shipment_data_complete"} in issues


def test_classify_auxiliary_sheet_is_other_not_error():
    # The real file's 7-column helper sheet: all are main columns, but far too
    # few to be a broken main sheet -> classified as an unrelated/auxiliary sheet.
    header = ["freezer", "shelf", "rack", "drawer", "box_pos", "box_type", "box"]
    status, schema, issues = registry.classify(header)
    assert status == "other"
    assert issues == []


def test_classify_completely_unrelated_is_other():
    status, _, issues = registry.classify(["alpha", "beta", "gamma"])
    assert status == "other"
    assert issues == []
