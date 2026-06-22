def test_save_and_read_roundtrip(app_env):
    import app.storage as storage

    payload = b"hello-bytes-\x00\x01"
    path = storage.save_upload("foo.xlsx", payload)
    assert storage.read_raw(path) == payload


def test_filerecord_insert_and_query(app_env):
    import app.models as models

    with models.get_session() as session:
        rec = models.FileRecord(
            original_filename="x.xlsx",
            stored_path="/tmp/x.xlsx",
            cache_path="/tmp/x.xlsx.parsed.json",
            size=10,
            content_type="application/octet-stream",
            sheet_count=2,
            schema_type="main_library",
            validation_status="valid",
        )
        session.add(rec)
        session.commit()
        session.refresh(rec)
        assert rec.id is not None

    with models.get_session() as session:
        from sqlmodel import select

        rows = session.exec(select(models.FileRecord)).all()
        assert len(rows) == 1
        assert rows[0].original_filename == "x.xlsx"
