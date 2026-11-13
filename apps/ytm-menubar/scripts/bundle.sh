#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CONFIG="release"
RUN_AFTER=false

for arg in "$@"; do
  case "$arg" in
    --debug)
      CONFIG="debug"
      ;;
    --release)
      CONFIG="release"
      ;;
    --run)
      RUN_AFTER=true
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: $0 [--debug|--release] [--run]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${SDKROOT:-}" ]] && [[ -d "/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk" ]]; then
  # MacOSX27.0.sdk in CommandLineTools lacks SwiftUIMacros plugin; MacOSX26.5.sdk builds SwiftUI cleanly.
  export SDKROOT="/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk"
fi

echo "Building YTMusicBar ($CONFIG)..."
swift build --build-system native -c "$CONFIG"

BIN_DIR="$(swift build --build-system native -c "$CONFIG" --show-bin-path)"
BIN_PATH="$BIN_DIR/YTMusicBar"
APP_BUNDLE="$ROOT_DIR/.build/YTMusicBar.app"

if [[ ! -f "$BIN_PATH" ]]; then
  echo "Error: Binary not found at $BIN_PATH" >&2
  exit 1
fi

rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Resources"

cp "$BIN_PATH" "$APP_BUNDLE/Contents/MacOS/YTMusicBar"
cp "$ROOT_DIR/Resources/Info.plist" "$APP_BUNDLE/Contents/Info.plist"

echo "Codesigning $APP_BUNDLE..."
codesign --force --deep --sign - "$APP_BUNDLE"

echo "Created $APP_BUNDLE"

if [[ "$RUN_AFTER" == true ]]; then
  echo "Launching $APP_BUNDLE..."
  open "$APP_BUNDLE"
fi
