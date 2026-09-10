#!/usr/bin/env bash
# Runs inside android-emulator-runner once the emulator has booted.
# Installs the freshly built APK and drives it with Maestro against the live
# Supabase project; screenshots end up in ./screenshots, logs in ./maestro-debug.
set -euo pipefail

: "${SMOKE_EMAIL:?SMOKE_EMAIL is required}"
: "${SMOKE_PASSWORD:?SMOKE_PASSWORD is required}"

# The google_apis image's Pixel Launcher occasionally ANRs under CI load; the
# resulting system dialog sits on top of every app and hides it from Maestro.
adb shell settings put global hide_error_dialogs 1 || true
adb shell settings put secure show_first_crash_dialog 0 || true
adb shell settings put global window_animation_scale 0 || true
adb shell settings put global transition_animation_scale 0 || true
adb shell settings put global animator_duration_scale 0 || true

adb install -r apk/app-release.apk
# Let the system settle after the install so the first launch isn't racing
# the launcher / profile installer.
sleep 5
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
