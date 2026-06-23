"""Desktop launcher for the packaged Mac app.

Starts the FastAPI server on a local port in a background thread, then shows it
in a native window (pywebview). Falls back to the default browser if the webview
backend is unavailable. Closing the window quits the app (and the server).
"""
from __future__ import annotations

import os
import socket
import threading
import time

import uvicorn

from app.main import app

HOST = "127.0.0.1"


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, 0))
        return s.getsockname()[1]


def _wait_until_up(port: int, timeout: float = 20.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex((HOST, port)) == 0:
                return
        time.sleep(0.1)


def main() -> None:
    # KOLABS_PORT pins the port; KOLABS_NO_WINDOW skips the GUI (used for headless
    # checks and for users who prefer their own browser).
    port = int(os.environ.get("KOLABS_PORT") or _free_port())
    no_window = os.environ.get("KOLABS_NO_WINDOW") == "1"

    server = uvicorn.Server(
        uvicorn.Config(app, host=HOST, port=port, log_level="warning")
    )
    threading.Thread(target=server.run, daemon=True).start()
    _wait_until_up(port)
    url = f"http://{HOST}:{port}"

    if not no_window:
        try:
            import webview

            webview.create_window(
                "Kolabs Sample Management", url, width=1320, height=860
            )
            webview.start()  # blocks on the main thread until the window closes
            return
        except Exception:
            pass

    import webbrowser

    webbrowser.open(url)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
