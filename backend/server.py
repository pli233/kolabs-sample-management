"""Headless backend entry for the Electron app.

Runs the FastAPI server on the port given by $PORT (Electron picks a free one),
with no window — Electron owns the UI and spawns this as a sidecar process.
"""
from __future__ import annotations

import os

import uvicorn

from app.main import app


def main() -> None:
    port = int(os.environ.get("PORT") or 8000)
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
