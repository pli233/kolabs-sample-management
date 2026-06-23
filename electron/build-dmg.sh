#!/usr/bin/env bash
# Package the Electron desktop app into a .dmg (Apple Silicon).
# Builds the SPA, freezes a headless Python backend, then runs electron-builder.
set -euo pipefail
cd "$(dirname "$0")/.."   # repo root

echo "==> 1/3 frontend build"
( cd frontend && npm run build )

echo "==> 2/3 headless backend (PyInstaller onedir -> backend/dist/kolabs-backend)"
( cd backend
  rm -rf build dist kolabs-backend.spec "Kolabs Sample Management.spec"
  .venv/bin/python -m PyInstaller --noconfirm \
    --name kolabs-backend \
    --add-data "../frontend/dist:frontend/dist" \
    --collect-all uvicorn \
    --collect-submodules app \
    --hidden-import app.main \
    server.py )

echo "==> 3/3 electron-builder"
( cd electron && npm run dist )

echo "==> done:"
ls -1 electron/dist/*.dmg
