from app.tools.qc import parse_boxes, qc_sample


def test_parse_boxes_ranges_and_multi():
    assert parse_boxes("728") == ["728"]
    assert parse_boxes("716-719") == ["716", "717", "718", "719"]
    assert parse_boxes("716-719,722") == ["716", "717", "718", "719", "722"]
    assert parse_boxes("722,722") == ["722"]  # deduped


def _sheet(n_per_box):
    cols = ["project", "box", "sample_pos", "record_id"]
    rows = []
    for box in ("700", "701"):
        for i in range(n_per_box):
            rows.append(["L37", box, f"A{i:02d}", 1000 + i])
    return {"columns": cols, "rows": rows}


def test_sample_n_per_box_and_reproducible():
    sheet = _sheet(20)
    a = qc_sample(sheet, "L37", ["700", "701"], 5, seed=42)
    b = qc_sample(sheet, "L37", ["700", "701"], 5, seed=42)
    assert len(a["rows"]) == 10  # 5 per box * 2 boxes
    assert a["rows"] == b["rows"]  # same seed -> identical
    # different seed -> (very likely) different selection
    c = qc_sample(sheet, "L37", ["700", "701"], 5, seed=99)
    assert a["rows"] != c["rows"]


def test_sample_takes_all_when_fewer_than_n():
    sheet = _sheet(3)
    r = qc_sample(sheet, "L37", ["700"], 5, seed=1)
    assert len(r["rows"]) == 3  # only 3 available
    assert r["boxes"][0]["box"] == "700"
    assert r["boxes"][0]["available"] == 3
    assert r["boxes"][0]["sampled"] == 3
    assert r["boxes"][0]["status"] == "ok"


def test_ambiguous_box_still_returns_sample_rows():
    sheet = {
        "columns": ["project", "box", "freezer", "rack", "drawer", "box_pos", "sample_pos", "record_id"],
        "rows": [
            ["L37", "700", "1", "A", "1", "1", "A01", 1],
            ["L37", "700", "2", "B", "2", "2", "A02", 2],
        ],
    }

    result = qc_sample(sheet, "L37", ["700"], 5, seed=1)

    assert len(result["rows"]) == 2
    assert result["boxes"][0]["status"] == "ok"
    assert result["boxes"][0]["locationCount"] == 2
    assert result["ambiguousBoxes"] == []


def test_preferred_freezer_resolves_ambiguous_box():
    sheet = {
        "columns": ["project", "box", "freezer", "rack", "drawer", "box_pos", "sample_pos", "record_id"],
        "rows": [
            ["L37", "700", "1", "A", "1", "1", "A01", 1],
            ["L37", "700", "2", "B", "2", "2", "A02", 2],
            ["L37", "700", "2", "B", "2", "2", "A03", 3],
        ],
    }

    result = qc_sample(sheet, "L37", ["700"], 5, seed=1, preferred_freezer="2")

    assert len(result["rows"]) == 2
    assert result["boxes"][0]["status"] == "resolved_by_preferred_freezer"
    assert result["ambiguousBoxes"] == []
