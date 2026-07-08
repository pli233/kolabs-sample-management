from pathlib import Path

from app.tools.scan import build_missing_box_review, dedup_files, parse_scan, reconcile

_REAL_XLS = Path(__file__).resolve().parent.parent.parent / "data" / "sample_scan.xls"


def test_parse_real_xls():
    if not _REAL_XLS.exists():
        return
    records = parse_scan(_REAL_XLS.name, _REAL_XLS.read_bytes())
    assert records
    # RackID '37BOX716' -> project L37, box 716; positions normalized.
    sample = next(r for r in records if r["tube_code"] and r["tube_code"] != "No Tube")
    assert sample["project"] == "L37"
    assert sample["box"] == "716"
    assert sample["rack_id"] == "37BOX716"
    assert len(sample["position"]) == 3  # e.g. A02


def _db():
    cols = ["project", "box", "sample_pos", "cryobank", "record_id"]
    return {
        "columns": cols,
        "rows": [
            ["L37", "716", "A01", "NTBI1", 1],
            ["L37", "716", "A02", "NTBI2", 2],
            ["L37", "716", "A04", "NTBI3", 3],  # never scanned
        ],
    }


def _rec(code, pos):
    return {"tube_code": code, "project": "L37", "box": "716", "position": pos, "source": "s"}


def test_reconcile_matches_on_tube_code_only():
    records = [
        _rec("NTBI1", "A01"),   # correct
        _rec("NTBI2", "A01"),   # code exists but at wrong position
        _rec("NTBX9", "A02"),   # not in DB and conflicts with NTBI2's slot
        _rec("NTBX9", "A09"),   # duplicate
    ]
    out = reconcile(_db(), records)
    assert out["correct_matches"] == 1
    assert len(out["wrong_location"]) == 1
    assert out["wrong_location"][0]["tube_code"] == "NTBI2"
    assert out["wrong_location"][0]["expected_position"] == "A02"
    assert len(out["position_conflicts"]) == 2
    assert any(r["tube_code"] == "NTBX9" and r["expected_cryobank"] == "NTBI2" for r in out["position_conflicts"])
    assert len(out["scan_not_in_database"]) == 1  # only the non-conflicting A09 row
    assert len(out["database_not_in_scan"]) == 1  # NTBI3 was not scanned anywhere
    assert out["database_not_in_scan"][0]["cryobank"] == "NTBI3"
    assert any(
        d["tube_code"] == "NTBX9" and d["count"] == 2
        for d in out["duplicate_scan_tubecodes"]
    )


def test_missing_box_review_returns_db_rows_at_same_slot_only():
    records = [_rec("NTBX9", "A02")]
    review = build_missing_box_review(_db(), records)
    assert len(review) == 1
    assert review[0]["project"] == "L37"
    assert str(review[0]["box"]) == "716"
    assert review[0]["sample_pos"] == "A02"
    assert review[0]["scanned_tube_code"] == "NTBX9"


def test_missing_box_review_returns_blank_db_cols_when_slot_empty():
    records = [_rec("NTBX9", "A09")]
    review = build_missing_box_review(_db(), records)
    assert len(review) == 1
    assert review[0]["project"] is None
    assert review[0]["box"] is None
    assert review[0]["sample_pos"] is None
    assert review[0]["scanned_project"] == "L37"
    assert review[0]["scanned_box"] == "716"
    assert review[0]["scanned_position"] == "A09"


def test_dedup_drops_overlapping_file():
    a = [_rec(c, "A01") for c in ("A", "B", "C", "D", "E")]
    b = [_rec(c, "A01") for c in ("A", "B", "C", "D")]  # 100% overlap with a's subset
    result = dedup_files({"a.csv": a, "b.csv": b})
    assert result["kept"] == ["a.csv"]  # richer file kept
    dropped = [s for s in result["summary"] if s["status"] == "drop_duplicate"]
    assert [d["file"] for d in dropped] == ["b.csv"]
