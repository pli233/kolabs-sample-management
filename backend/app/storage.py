"""Disk storage for uploaded original files.

The original bytes must be preserved verbatim so the frontend can render the
Excel-faithful view (view A) from them.
"""
from __future__ import annotations

import json
import uuid
from collections import OrderedDict
from pathlib import Path

from .config import settings


def save_upload(filename: str, data: bytes) -> str:
    """Persist raw bytes under UPLOAD_DIR with a uuid prefix; return stored path."""
    settings.ensure_dirs()
    safe_name = Path(filename).name  # strip any path components
    stored_name = f"{uuid.uuid4().hex}__{safe_name}"
    dest = settings.UPLOAD_DIR / stored_name
    dest.write_bytes(data)
    return str(dest)


def read_raw(stored_path: str) -> bytes:
    return Path(stored_path).read_bytes()


def save_parsed(stored_path: str, sheets: list[dict]) -> str:
    """Cache the normalized (capped) sheets next to the original; return path."""
    cache_path = stored_path + ".parsed.json"
    Path(cache_path).write_text(
        json.dumps({"sheets": sheets}, ensure_ascii=False), encoding="utf-8"
    )
    return cache_path


# Small in-memory cache of full parsed workbooks so paginated /rows requests
# don't re-read (and re-decode) the large cache file on every call.
_PARSED_LRU: "OrderedDict[str, dict]" = OrderedDict()
_PARSED_LRU_MAX = 3


def load_parsed(cache_path: str) -> dict:
    cached = _PARSED_LRU.get(cache_path)
    if cached is not None:
        _PARSED_LRU.move_to_end(cache_path)
        return cached
    data = json.loads(Path(cache_path).read_text(encoding="utf-8"))
    _PARSED_LRU[cache_path] = data
    if len(_PARSED_LRU) > _PARSED_LRU_MAX:
        _PARSED_LRU.popitem(last=False)
    return data
