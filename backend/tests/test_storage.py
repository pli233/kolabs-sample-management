def test_dump_and_load_parsed_roundtrip(app_env):
    import app.storage as storage

    sheets = [{"name": "S1", "columns": ["a"], "rows": [[1], [2]]}]
    blob = storage.dump_parsed(sheets)
    assert storage.load_parsed(1, blob)["sheets"] == sheets
    # Second call hits the in-memory LRU and returns the same object.
    assert storage.load_parsed(1, blob) is storage.load_parsed(1, blob)


def test_filerecord_insert_and_query(app_env):
    import app.models as models

    with models.get_session() as session:
        rec = models.FileRecord(
            original_filename="x.xlsx",
            parsed_json='{"sheets": []}',
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
