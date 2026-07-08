from app.tools.aliquot import OUTPUT_COLS, find_aliquots, parse_pairs


def test_parse_pairs_tab_and_spaces_and_dedupes():
    text = "L37\t425280.01\nL40  416180\n416180.08\nL37\t425280.01"
    assert parse_pairs(text) == [
        ("L37", "425280.01"),
        ("L40", "416180"),
        (None, "416180.08"),
    ]


def _sheet(rows):
    cols = [
        "project",
        "project_id",
        "type",
        "volume_ul",
        "freezer",
        "rack",
        "drawer",
        "box_pos",
        "box",
        "sample_pos",
        "aliquot",
        "cryobank",
        "track_id",
        "record_id",
    ]
    return {"columns": cols, "rows": rows}


def _tube(project_id, freezer, aliquot_id, project="L37", tube_type="Soro", volume="80"):
    return [
        project,
        project_id,
        tube_type,
        volume,
        freezer,
        "1",
        "1",
        "1",
        "300",
        "A01",
        aliquot_id,
        "NTBI" + aliquot_id,
        "trk" + aliquot_id,
        aliquot_id,
    ]


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
    res = find_aliquots(sheet, [("L37", "416180")], preferred_freezer=None, backups=3)
    primary = next(r for r in res["rows"] if _col(r, "choice") == "PRIMARY")
    assert _col(primary, "input_project") == "L37"
    assert _col(primary, "selected_freezer") == "3"
    assert _col(primary, "total_count") == 3
    assert _col(primary, "selected_freezer_count") == 2
    backups = [r for r in res["rows"] if _col(r, "choice") == "BACKUP"]
    assert len(backups) == 2  # remaining tubes as backups


def test_exact_match_with_dot():
    sheet = _sheet([_tube("425280.01", "3", "1"), _tube("425280.02", "3", "2")])
    res = find_aliquots(sheet, [(None, "425280.01")], None, 3)
    assert all(_col(r, "matched_project_id") == "425280.01" for r in res["rows"])


def test_project_is_hard_filter():
    # Same project_id under two projects: the project must disambiguate.
    sheet = _sheet(
        [
            _tube("416180.08", "3", "1", project="L37"),
            _tube("416180.08", "1", "2", project="L40"),
        ]
    )
    res = find_aliquots(sheet, [("L40", "416180.08")], None, 3)
    rows = [r for r in res["rows"] if _col(r, "choice") != "NOT FOUND"]
    assert len(rows) == 1
    assert _col(rows[0], "freezer") == "1"  # the L40 tube, not the L37 one
    assert _col(rows[0], "input_project") == "L40"


def test_no_project_matches_across_projects():
    sheet = _sheet(
        [
            _tube("416180.08", "3", "1", project="L37"),
            _tube("416180.08", "1", "2", project="L40"),
        ]
    )
    res = find_aliquots(sheet, [(None, "416180.08")], None, 3)
    assert _col(res["rows"][0], "total_count") == 2  # both projects matched


def test_not_found_includes_pair_in_note():
    sheet = _sheet([_tube("416180.04", "3", "1")])
    res = find_aliquots(sheet, [("L37", "999999")], None, 3)
    assert len(res["rows"]) == 1
    assert _col(res["rows"][0], "choice") == "NOT FOUND"
    assert _col(res["rows"][0], "input_project") == "L37"
    assert "L37 / 999999" in _col(res["rows"][0], "note")


def test_preferred_freezer_fallback_notes():
    sheet = _sheet([_tube("416180.04", "3", "1")])
    res = find_aliquots(sheet, [("L37", "416180.04")], preferred_freezer="9", backups=0)
    assert "Preferred freezer 9" in _col(res["rows"][0], "note")


def test_output_includes_source_columns_for_filtering():
    sheet = _sheet([_tube("416180.04", "3", "1", tube_type="Soro", volume="55")])
    res = find_aliquots(sheet, [("L37", "416180.04")], None, 0)

    assert "type" in res["columns"]
    assert "volume_ul" in res["columns"]
    first = res["rows"][0]
    assert first[res["columns"].index("type")] == "Soro"
    assert first[res["columns"].index("volume_ul")] == "55"


def test_filters_apply_before_primary_and_backups():
    sheet = _sheet(
        [
            _tube("416180.04", "3", "1", tube_type="Soro", volume="80"),
            _tube("416180.04", "3", "2", tube_type="Saliva", volume="80"),
            _tube("416180.04", "1", "3", tube_type="Soro", volume="40"),
            _tube("416180.04", "1", "4", tube_type="Soro", volume="60"),
        ]
    )

    res = find_aliquots(
        sheet,
        [("L37", "416180.04")],
        preferred_freezer=None,
        backups=2,
        filters=[
            {"column": "type", "op": "equals", "value": "Soro"},
            {"column": "volume_ul", "op": "gte", "value": "50"},
        ],
        match_mode="all",
    )

    assert len(res["rows"]) == 2
    assert all(row[res["columns"].index("type")] == "Soro" for row in res["rows"])
    assert all(float(row[res["columns"].index("volume_ul")]) >= 50 for row in res["rows"])
    assert res["rows"][0][res["columns"].index("choice")] == "PRIMARY"
    assert res["rows"][1][res["columns"].index("choice")] == "BACKUP"
