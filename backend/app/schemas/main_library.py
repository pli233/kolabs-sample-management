"""Fixed-column schema for the main biorepository library export.

Derived from ``data/数据库下载结果.xlsx`` (sheet "NEWSorotecaOfThePauD_DATA").
This is the only schema implemented this iteration; others are added later.
"""
from __future__ import annotations

MAIN_LIBRARY_NAME = "main_library"

MAIN_LIBRARY_COLUMNS: list[str] = [
    "record_id",
    "project",
    "project_id",
    "sample",
    "type",
    "track_id",
    "aliquot",
    "volume_ul",
    "temp",
    "freezer",
    "shelf",
    "rack",
    "drawer",
    "box_pos",
    "box_type",
    "box",
    "sample_pos",
    "thawed",
    "date_thawed",
    "date_shipped",
    "source",
    "date_frozen",
    "obs",
    "cryobank",
    "not_in_box",
    "empty_shipped",
    "zika_project",
    "at_yale",
    "sent_collaborator",
    "date_shipped_collab",
    "date_returned",
    "thawed_aliq",
    "volume_alert",
    "soroteca_yale_complete",
    "shipment_date",
    "shipment_box",
    "shipment_position",
    "volume_sent",
    "current_volume",
    "institution_name",
    "researcher_name",
    "shipping_notes",
    "shipment_data_complete",
]
