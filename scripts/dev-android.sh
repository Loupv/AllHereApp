#!/usr/bin/env bash
# Fast Android iteration loop: build a release APK with the current
# version + install it on the first connected adb device. No version
# bump — meant for back-to-back testing of code changes, not for store
# submission. Use `npm run ship` (or `npm run ship:android`) when you
# actually want to upload to Play Console.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! adb get-state >/dev/null 2>&1; then
  echo "✘ No Android device connected (adb get-state failed)."
  echo "  Plug in your phone with USB debugging enabled and try again."
  exit 1
fi

echo "▶ Building Android release APK (arm64-v8a only)…"
(cd android && ./gradlew assembleRelease)

APK=android/app/build/outputs/apk/release/app-release.apk
cp "$APK" android/allhere-arm64.apk

echo "▶ Installing on device…"
adb install -r android/allhere-arm64.apk

echo "✓ Installed. Open the app on your phone to test."
