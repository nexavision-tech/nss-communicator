#!/usr/bin/env bash
# build-chrome.sh — Build a Chrome MV3 distribution of NSS Communicator
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src"
DIST_DIR="$SCRIPT_DIR/dist/chrome"

echo "==> Cleaning previous build…"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

echo "==> Copying src/ into dist/chrome/…"
cp -r "$SRC_DIR"/* "$DIST_DIR"/

echo "==> Bundling background scripts into background-bundle.js…"
{
  # Polyfill: map Firefox's `browser` namespace to Chrome's `chrome` namespace
  echo '// --- Chrome MV3 polyfill ---'
  echo 'if (typeof browser === "undefined") { globalThis.browser = chrome; }'
  echo ''

  # Concatenate the four background scripts in the original load order
  for file in crypto/keys.js crypto/encrypt.js storage/keyring.js background.js; do
    echo "// --- $file ---"
    cat "$SRC_DIR/$file"
    echo ''
  done
} > "$DIST_DIR/background-bundle.js"

echo "==> Replacing manifest with Chrome MV3 version…"
cp "$SRC_DIR/chrome-manifest.json" "$DIST_DIR/manifest.json"

# Remove the Firefox-only manifest and the chrome-manifest source copy
rm -f "$DIST_DIR/chrome-manifest.json"

echo "==> Packaging dist/chrome.zip…"
(cd "$DIST_DIR" && zip -r "$SCRIPT_DIR/dist/chrome.zip" .)

echo "==> Done!  Outputs:"
echo "      Directory : $DIST_DIR"
echo "      ZIP       : $SCRIPT_DIR/dist/chrome.zip"
