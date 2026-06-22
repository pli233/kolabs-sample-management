from pathlib import Path

from app.tools.scan import dedup_files, parse_scan, reconcile

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


def test_reconcile_categories():
    records = [
        _rec("NTBI1", "A01"),   # correct
        _rec("NTBI2", "A01"),   # wrong_location (exp A02) + position_conflict (A01=NTBI1)
        _rec("NTBX9", "A09"),   # not in database
        _rec("NTBX9", "A09"),   # duplicate
    ]
    out = reconcile(_db(), records)
    assert out["correct_matches"] == 1
    assert len(out["wrong_location"]) == 1
    assert out["wrong_location"][0]["tube_code"] == "NTBI2"
    assert len(out["scan_not_in_database"]) == 2  # NTBX9 twice
    assert any(c["tube_code"] == "NTBI2" for c in out["position_conflicts"])
    assert any(d["tube_code"] == "NTBI3" for d in out["database_not_in_scan"])
    assert any(
        d["tube_code"] == "NTBX9" and d["count"] == 2
        for d in out["duplicate_scan_tubecodes"]
    )


def test_dedup_drops_overlapping_file():
    a = [_rec(c, "A01") for c in ("A", "B", "C", "D", "E")]
    b = [_rec(c, "A01") for c in ("A", "B", "C", "D")]  # 100% overlap with a's subset
    result = dedup_files({"a.csv": a, "b.csv": b})
    assert result["kept"] == ["a.csv"]  # richer file kept
    dropped = [s for s in result["summary"] if s["status"] == "drop_duplicate"]
    assert [d["file"] for d in dropped] == ["b.csv"]
