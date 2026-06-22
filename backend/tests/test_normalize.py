from app.normalize import normalize_box, normalize_position, normalizer_for


def test_normalize_box_strips_leading_zeros():
    assert normalize_box("0728") == "728"
    assert normalize_box(728) == "728"
    assert normalize_box("728") == "728"
    assert normalize_box(None) is None


def test_normalize_position_pads():
    assert normalize_position("a1") == "A01"
    assert normalize_position("A01") == "A01"
    assert normalize_position("B12") == "B12"
    assert normalize_position(None) is None


def test_normalizer_for_known_columns():
    assert normalizer_for("box") is normalize_box
    assert normalizer_for("sample_pos") is normalize_position
    assert normalizer_for("project") is None
