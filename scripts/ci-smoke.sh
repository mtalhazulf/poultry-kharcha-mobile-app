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

# Many staff phones use the 3-button navigation bar, which is taller than the
# gesture handle. Run with it so screenshots catch anything it would cover.
adb shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.threebutton || true

adb install -r apk/app-release.apk

# Seed the emulator gallery with a sample receipt so the flow can exercise
# the Photo Picker -> upload -> signed-URL round trip.
adb shell mkdir -p /sdcard/Pictures
adb push .maestro/fixtures/receipt.jpg /sdcard/Pictures/receipt.jpg
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/receipt.jpg >/dev/null 2>&1 || true
adb shell content call --uri content://media/external/file --method scan_file --arg /sdcard/Pictures/receipt.jpg >/dev/null 2>&1 || true
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
