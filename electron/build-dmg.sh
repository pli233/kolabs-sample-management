#!/usr/bin/env bash
# Package the Electron desktop app into a .dmg.
# Usage: build-dmg.sh [arm64|x64]   (default: host arch)
# Builds the SPA, freezes a headless Python backend for the target arch, then
# runs electron-builder. The backend is the arch-sensitive part: PyInstaller
# freezes for whichever Python runs it, so an Intel build needs an x86_64 venv
# (created via Rosetta from the universal2 /usr/bin/python3).
set -euo pipefail
cd "$(dirname "$0")/.."   # repo root

ARCH="${1:-$(uname -m)}"
case "$ARCH" in
  arm64|aarch64) ARCH=arm64; VENV=backend/.venv;     PYRUN=(arch -arm64); EB_FLAG=(--arm64) ;;
  x64|x86_64)    ARCH=x64;   VENV=backend/.venv-x64;  PYRUN=(arch -x86_64); EB_FLAG=(--x64)   ;;
  *) echo "unknown arch: $ARCH (use arm64 or x64)"; exit 1 ;;
esac
PY="$PWD/$VENV/bin/python"
echo "==> target arch: $ARCH (venv: $VENV)"

echo "==> 1/4 frontend build"
( cd frontend && npm run build )

echo "==> 2/4 backend venv"
if [ ! -x "$PY" ]; then
  "${PYRUN[@]}" /usr/bin/python3 -m venv "$VENV"
  "${PYRUN[@]}" "$PY" -m pip install -U pip
  "${PYRUN[@]}" "$PY" -m pip install -r backend/requirements.txt pyinstaller
fi

echo "==> 3/4 headless backend (PyInstaller onedir -> backend/dist/kolabs-backend)"
( cd backend
  rm -rf build dist kolabs-backend.spec "Kolabs Sample Management.spec"
  "${PYRUN[@]}" "$PY" -m PyInstaller --noconfirm \
    --name kolabs-backend \
    --add-data "../frontend/dist:frontend/dist" \
    --collect-all uvicorn \
    --collect-submodules app \
    --hidden-import app.main \
    server.py )

echo "==> 4/4 electron-builder"
( cd electron && npm run dist -- "${EB_FLAG[@]}" )

echo "==> done:"
ls -1 electron/dist/*.dmg
