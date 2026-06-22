from app.schemas.main_library import MAIN_LIBRARY_COLUMNS


def _upload_sample(client, sample_xlsx_path):
    with open(sample_xlsx_path, "rb") as f:
        return client.post(
            "/api/files",
            files={
                "file": (
                    "数据库下载结果.xlsx",
                    f,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )


def test_upload_main_library(client, sample_xlsx_path):
    resp = _upload_sample(client, sample_xlsx_path)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # The standard DB download is VALID: its main data sheet matches the schema,
    # and the 7-column helper sheet (an "other" sheet) does not poison the verdict.
    assert body["schema_type"] == "main_library"
    assert body["validation_status"] == "valid"
    assert body["sheet_count"] >= 1
    assert body["id"] is not None
    # Default primary sheet is the matched one.
    primary = next(s for s in body["sheets"] if s["name"] == body["primary_sheet"])
    assert primary["match"] == "matched"
    # The picker payload classifies every sheet.
    assert {s["match"] for s in body["sheets"]} <= {"matched", "partial", "other"}


def test_set_primary_sheet_changes_status(client, sample_xlsx_path):
    body = _upload_sample(client, sample_xlsx_path).json()
    fid = body["id"]
    # The 7-column helper sheet is "other"; choosing it makes the file unrecognized.
    aux = next(s for s in body["sheets"] if s["match"] == "other")
    resp = client.patch(f"/api/files/{fid}", json={"primary_sheet": aux["name"]})
    assert resp.status_code == 200
    assert resp.json()["validation_status"] == "unrecognized"
    assert resp.json()["primary_sheet"] == aux["name"]

    # Switch back to a matched sheet -> valid again.
    main = next(s for s in body["sheets"] if s["match"] == "matched")
    resp = client.patch(f"/api/files/{fid}", json={"primary_sheet": main["name"]})
    assert resp.json()["validation_status"] == "valid"


def test_set_primary_sheet_unknown_400(client, sample_xlsx_path):
    fid = _upload_sample(client, sample_xlsx_path).json()["id"]
    resp = client.patch(f"/api/files/{fid}", json={"primary_sheet": "nope"})
    assert resp.status_code == 400


def test_list_contains_uploaded(client, sample_xlsx_path):
    _upload_sample(client, sample_xlsx_path)
    resp = client.get("/api/files")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["schema_type"] == "main_library"


def test_raw_matches_original(client, sample_xlsx_path):
    up = _upload_sample(client, sample_xlsx_path).json()
    resp = client.get(f"/api/files/{up['id']}/raw")
    assert resp.status_code == 200
    assert resp.content == sample_xlsx_path.read_bytes()


def test_rows_paginates_full_dataset(client, sample_xlsx_path):
    up = _upload_sample(client, sample_xlsx_path).json()
    fid = up["id"]
    body = client.get(f"/api/files/{fid}/rows?offset=0&limit=50").json()
    assert body["columns"] == list(MAIN_LIBRARY_COLUMNS)
    # The full main sheet has far more than the old 5000-row cap.
    assert body["total"] > 100_000
    assert body["filtered"] == body["total"]
    assert len(body["rows"]) == 50
    # A deep page returns different rows (proves it's not capped).
    deep = client.get(f"/api/files/{fid}/rows?offset=200000&limit=10").json()
    assert len(deep["rows"]) == 10
    assert deep["rows"][0] != body["rows"][0]


def test_rows_global_search(client, sample_xlsx_path):
    fid = _upload_sample(client, sample_xlsx_path).json()["id"]
    body = client.get(f"/api/files/{fid}/rows?q=416180.08&limit=5").json()
    assert 0 < body["filtered"] < body["total"]
    # Every returned row contains the query somewhere.
    assert all(any("416180.08" in str(c) for c in row) for row in body["rows"])


def test_rows_numeric_column_filter(client, sample_xlsx_path):
    import json

    fid = _upload_sample(client, sample_xlsx_path).json()["id"]
    filters = json.dumps([{"column": "record_id", "op": "gt", "value": "266865"}])
    body = client.get(f"/api/files/{fid}/rows", params={"filters": filters}).json()
    assert 0 < body["filtered"] < body["total"]
    assert all(row[0] > 266865 for row in body["rows"])


def test_rows_multi_condition_and(client, sample_xlsx_path):
    import json

    fid = _upload_sample(client, sample_xlsx_path).json()["id"]
    filters = json.dumps(
        [
            {"column": "record_id", "op": "gte", "value": "1"},
            {"column": "record_id", "op": "lte", "value": "5"},
        ]
    )
    body = client.get(
        f"/api/files/{fid}/rows", params={"filters": filters, "match": "all"}
    ).json()
    assert body["filtered"] == 5
    assert sorted(row[0] for row in body["rows"]) == [1, 2, 3, 4, 5]


def test_rows_multi_condition_any(client, sample_xlsx_path):
    import json

    fid = _upload_sample(client, sample_xlsx_path).json()["id"]

    def count(conds, mode="all"):
        return client.get(
            f"/api/files/{fid}/rows",
            params={"filters": json.dumps(conds), "match": mode},
        ).json()["filtered"]

    low = [{"column": "record_id", "op": "lt", "value": "3"}]
    high = [{"column": "record_id", "op": "gt", "value": "266869"}]
    # The two ranges are disjoint, so OR == sum of the parts.
    any_count = count(low + high, "any")
    assert any_count == count(low) + count(high)
    assert any_count > count(low)  # OR is strictly larger than either part


def test_rows_sort_by_column(client, sample_xlsx_path):
    fid = _upload_sample(client, sample_xlsx_path).json()["id"]
    desc = client.get(
        f"/api/files/{fid}/rows?sort=record_id&dir=desc&limit=5"
    ).json()
    ids = [row[0] for row in desc["rows"]]
    assert ids == sorted(ids, reverse=True)


def test_rows_follow_primary_sheet_change(client, sample_xlsx_path):
    up = _upload_sample(client, sample_xlsx_path).json()
    aux = next(s for s in up["sheets"] if s["match"] == "other")
    client.patch(f"/api/files/{up['id']}", json={"primary_sheet": aux["name"]})
    body = client.get(f"/api/files/{up['id']}/rows").json()
    assert body["total"] == aux["rowCount"]
    assert body["columns"][0] == "freezer"


def test_reject_unsupported_type(client):
    resp = client.post(
        "/api/files",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert resp.status_code == 415


def test_missing_file_404(client):
    assert client.get("/api/files/9999").status_code == 404
    assert client.get("/api/files/9999/raw").status_code == 404
    assert client.get("/api/files/9999/rows").status_code == 404
