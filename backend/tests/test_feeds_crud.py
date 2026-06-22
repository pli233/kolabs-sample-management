"""Feed CRUD + active-feed switching, using fabricated schema-valid workbooks."""
import io

from openpyxl import Workbook

from app.schemas.main_library import MAIN_LIBRARY_COLUMNS


def _make_feed(record_ids: list[int], project: str = "L37") -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "main"
    ws.append(list(MAIN_LIBRARY_COLUMNS))  # exact header -> schema "matched"
    width = len(MAIN_LIBRARY_COLUMNS)
    for rid in record_ids:
        row = [rid, project] + [None] * (width - 2)
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _upload(client, data: bytes, name: str):
    return client.post(
        "/api/files",
        files={
            "file": (
                name,
                data,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )


def test_upload_two_feeds_and_switch_active(client):
    a = _upload(client, _make_feed([1, 2, 3]), "feed_a.xlsx").json()
    b = _upload(client, _make_feed([100, 101]), "feed_b.xlsx").json()
    assert a["validation_status"] == "valid" and b["validation_status"] == "valid"

    # Newest upload (B) is active; /rows reflects B's two rows.
    assert client.get("/api/active-feed").json()["active"]["id"] == b["id"]
    rows_b = client.get(f"/api/files/{b['id']}/rows").json()
    assert rows_b["total"] == 2
    assert sorted(r[0] for r in rows_b["rows"]) == [100, 101]

    # Switch active to A; its three rows show.
    client.put("/api/active-feed", json={"file_id": a["id"]})
    assert client.get("/api/active-feed").json()["active"]["id"] == a["id"]
    rows_a = client.get(f"/api/files/{a['id']}/rows").json()
    assert rows_a["total"] == 3
    assert sorted(r[0] for r in rows_a["rows"]) == [1, 2, 3]


def test_delete_active_reassigns_and_removes_file(client):
    a = _upload(client, _make_feed([1]), "feed_a.xlsx").json()
    b = _upload(client, _make_feed([2]), "feed_b.xlsx").json()
    # B is active; delete B -> reassigns to A (the remaining feed).
    resp = client.delete(f"/api/files/{b['id']}")
    assert resp.status_code == 200
    assert resp.json()["active"] == a["id"]
    assert client.get("/api/active-feed").json()["active"]["id"] == a["id"]
    assert client.get(f"/api/files/{b['id']}").status_code == 404
    assert len(client.get("/api/files").json()) == 1


def test_delete_last_feed_clears_active(client):
    a = _upload(client, _make_feed([1]), "only.xlsx").json()
    client.delete(f"/api/files/{a['id']}")
    assert client.get("/api/active-feed").json()["active"] is None
    assert client.get("/api/files").json() == []
