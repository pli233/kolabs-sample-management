from app.tools.aliquot import OUTPUT_COLS, find_aliquots, parse_ids


def test_parse_ids_splits_and_dedupes():
    assert parse_ids("a, b  c\nd,a") == ["a", "b", "c", "d"]


def _sheet(rows):
    cols = ["project", "project_id", "freezer", "rack", "drawer", "box_pos",
            "box", "sample_pos", "aliquot", "cryobank", "track_id", "record_id"]
    return {"columns": cols, "rows": rows}


def _tube(project_id, freezer, aliquot_id):
    return ["L37", project_id, freezer, "1", "1", "1", "300",
            "A01", aliquot_id, "NTBI" + aliquot_id, "trk" + aliquot_id, aliquot_id]


def _col(row, name):
    return row[OUTPUT_COLS.index(name)]


def test_prefix_match_and_primary_backup():
    sheet = _sheet(
        [
            _tube("416180.04", "3", "1"),
            _tube("416180.04", "3", "2"),
            _tube("416180.08", "1", "3"),
        ]
    )
    # no dot -> matches both 416180.* ; freezer 3 has the most (2) -> chosen
    res = find_aliquots(sheet, ["416180"], preferred_freezer=None, backups=3)
    primary = next(r for r in res["rows"] if _col(r, "choice") == "PRIMARY")
    assert _col(primary, "selected_freezer") == "3"
    assert _col(primary, "total_count") == 3
    assert _col(primary, "selected_freezer_count") == 2
    backups = [r for r in res["rows"] if _col(r, "choice") == "BACKUP"]
    assert len(backups) == 2  # remaining tubes as backups


def test_exact_match_with_dot():
    sheet = _sheet([_tube("425280.01", "3", "1"), _tube("425280.02", "3", "2")])
    res = find_aliquots(sheet, ["425280.01"], None, 3)
    assert all(_col(r, "matched_project_id") == "425280.01" for r in res["rows"])


def test_not_found():
    sheet = _sheet([_tube("416180.04", "3", "1")])
    res = find_aliquots(sheet, ["999999"], None, 3)
    assert len(res["rows"]) == 1
    assert _col(res["rows"][0], "choice") == "NOT FOUND"


def test_preferred_freezer_fallback_notes():
    sheet = _sheet([_tube("416180.04", "3", "1")])
    res = find_aliquots(sheet, ["416180.04"], preferred_freezer="9", backups=0)
    assert "Preferred freezer 9" in _col(res["rows"][0], "note")
