"""Parsed-sheet storage.

The normalized sheets live in the database (FileRecord.parsed_json), so no disk
is needed — the app runs fine on ephemeral filesystems. A small in-memory LRU
avoids re-decoding the JSON on every paginated request.
"""
from __future__ import annotations

import json
from collections import OrderedDict


def dump_parsed(sheets: list[dict]) -> str:
    """Serialize parsed sheets for the FileRecord.parsed_json column."""
    return json.dumps({"sheets": sheets}, ensure_ascii=False)


# Cache decoded workbooks by file id. parsed_json is immutable per record, so the
# id is a safe key. Cleared on engine reset (tests) to avoid cross-DB leakage.
_PARSED_LRU: "OrderedDict[int, dict]" = OrderedDict()
_PARSED_LRU_MAX = 3


def clear_cache() -> None:
    _PARSED_LRU.clear()


def load_parsed(file_id: int, parsed_json: str) -> dict:
    cached = _PARSED_LRU.get(file_id)
    if cached is not None:
        _PARSED_LRU.move_to_end(file_id)
        return cached
    data = json.loads(parsed_json) if parsed_json else {"sheets": []}
    _PARSED_LRU[file_id] = data
    if len(_PARSED_LRU) > _PARSED_LRU_MAX:
        _PARSED_LRU.popitem(last=False)
    return data
