#!/usr/bin/env bash
# Runs inside android-emulator-runner once the emulator has booted.
# Installs the freshly built APK and drives it with Maestro against the live
# Supabase project; screenshots end up in ./screenshots, logs in ./maestro-debug.
set -euo pipefail

: "${SMOKE_EMAIL:?SMOKE_EMAIL is required}"
: "${SMOKE_PASSWORD:?SMOKE_PASSWORD is required}"

adb install -r apk/app-release.apk
mkdir -p screenshots maestro-debug
cd screenshots

if ! maestro test ../.maestro/smoke.yaml \
    -e EMAIL="$SMOKE_EMAIL" \
    -e PASSWORD="$SMOKE_PASSWORD" \
    --debug-output ../maestro-debug; then
  adb exec-out screencap -p > 99-failure.png || true
  adb logcat -d -v time > ../maestro-debug/logcat.txt || true
  exit 1
fi
