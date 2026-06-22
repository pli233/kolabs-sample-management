from app.tools.box_lookup import lookup_box, to_table


def _sheet(rows):
    cols = [
        "project", "freezer", "shelf", "rack", "drawer", "box_pos", "box",
        "sample_pos", "cryobank", "aliquot", "track_id", "record_id", "project_id",
    ]
    return {"columns": cols, "rows": rows}


def _row(project, freezer, box, sample_pos, cryobank):
    # positional per the column order above
    return [project, freezer, "", "", "", "", box, sample_pos, cryobank, "", "", "", ""]


def test_groups_by_unique_location_with_two_examples():
    sheet = _sheet(
        [
            _row("L37", "3", "728", "A01", "NTBI1"),
            _row("L37", "3", "728", "A02", "NTBI2"),
            _row("L37", "3", "728", "A03", "NTBI3"),
            _row("L38", "1", "728", "B01", "NTBI4"),
        ]
    )
    result = lookup_box(sheet, "0728")  # leading zero normalized
    assert result["box"] == "728"
    assert len(result["locations"]) == 2  # two distinct (project,freezer) locations
    l37 = next(l for l in result["locations"] if l["location"]["project"] == "L37")
    assert l37["count"] == 3
    assert len(l37["examples"]) == 2  # capped at 2


def test_skips_non_tube_rows():
    sheet = _sheet(
        [
            _row("L37", "3", "728", "A01", "NTBI1"),
            ["L37", "3", "", "", "", "", "728", "", "", "", "", "", ""],  # all blank tube fields
        ]
    )
    result = lookup_box(sheet, "728")
    assert sum(l["count"] for l in result["locations"]) == 1


def test_to_table_flattens():
    sheet = _sheet([_row("L37", "3", "728", "A01", "NTBI1")])
    cols, rows = to_table(lookup_box(sheet, "728"))
    assert "tube_count" in cols and "sample_pos" in cols
    assert len(rows) == 1
