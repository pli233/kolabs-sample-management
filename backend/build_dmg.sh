#!/usr/bin/env bash
# Build the macOS .app + .dmg for Kolabs Sample Management (Apple Silicon).
# Run from the backend/ dir with the venv active deps installed.
#   ./build_dmg.sh   -> dist/KolabsSampleManagement.dmg
set -euo pipefail
cd "$(dirname "$0")"

APP_NAME="Kolabs Sample Management"
PY="${PY:-.venv/bin/python}"

echo "==> Building frontend"
( cd ../frontend && npm run build )

echo "==> Ensuring packaging deps"
"$PY" -m pip install -q pyinstaller pywebview

echo "==> PyInstaller bundle"
rm -rf build dist "$APP_NAME.spec"
"$PY" -m PyInstaller --noconfirm --windowed \
  --name "$APP_NAME" \
  --osx-bundle-identifier com.kolabs.samplemanagement \
  --add-data "../frontend/dist:frontend/dist" \
  --collect-all uvicorn \
  --collect-all webview \
  --collect-submodules app \
  --hidden-import app.main \
  desktop.py

echo "==> Packaging .dmg (drag-to-Applications)"
STAGING="$(mktemp -d)"
cp -R "dist/$APP_NAME.app" "$STAGING/"
ln -s /Applications "$STAGING/Applications"
hdiutil create -volname "$APP_NAME" -srcfolder "$STAGING" -ov -format UDZO \
  "dist/KolabsSampleManagement.dmg"
rm -rf "$STAGING"

echo "==> Done: backend/dist/KolabsSampleManagement.dmg"
