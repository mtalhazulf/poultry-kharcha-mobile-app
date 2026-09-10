#!/usr/bin/env bash
# =============================================================================
# Kharcha — one-shot macOS developer setup
#
#   curl -fsSL https://raw.githubusercontent.com/mtalhazulf/poultry-kharcha-mobile-app/claude/supabase-mcp-user-account-hy9cu3/scripts/macos-setup.sh | bash
#   # or, from a clone:  bash scripts/macos-setup.sh [--no-build] [--no-emulator] [--teleport]
#
# Installs: Homebrew, Bun, Node 22, Watchman, JDK 17, Android SDK (platform
# 36, build-tools, platform-tools, emulator + API 34 image), Claude Code CLI.
# Then: clones/updates the repo on the working branch, installs JS deps,
# writes .env, generates the upload keystore, builds the signed APK + AAB,
# optionally registers your Play Store MCP server and teleports this cloud
# session into your terminal.  Re-running skips anything already done.
# =============================================================================
set -euo pipefail

REPO_URL="https://github.com/mtalhazulf/poultry-kharcha-mobile-app.git"
BRANCH="claude/supabase-mcp-user-account-hy9cu3"
CLOUD_SESSION="session_0181YvXA9sUoL2sRY3DktXgV"
WORKDIR="${KHARCHA_DIR:-$HOME/Developer/poultry-kharcha-mobile-app}"
KEY_ALIAS="kharcha"
KEYSTORE_FILE="kharcha-upload.keystore"

DO_BUILD=1; DO_EMULATOR=1; DO_TELEPORT=0
for arg in "$@"; do
  case "$arg" in
    --no-build)    DO_BUILD=0 ;;
    --no-emulator) DO_EMULATOR=0 ;;
    --teleport)    DO_TELEPORT=1 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

log()  { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

[[ "$(uname -s)" == "Darwin" ]] || { echo "This script is for macOS." >&2; exit 1; }
ARCH="$(uname -m)"                      # arm64 (Apple Silicon) or x86_64 (Intel)
if [[ "$ARCH" == "arm64" ]]; then BREW_PREFIX=/opt/homebrew; EMU_ABI="arm64-v8a"; else BREW_PREFIX=/usr/local; EMU_ABI="x86_64"; fi

# Shell profile to persist env vars (zsh is the macOS default).
PROFILE="$HOME/.zprofile"; touch "$PROFILE"
persist() { grep -qF "$1" "$PROFILE" || echo "$1" >> "$PROFILE"; }

# ---------------------------------------------------------------------------
log "Xcode Command Line Tools (git, compilers)"
if ! xcode-select -p >/dev/null 2>&1; then
  xcode-select --install || true
  echo "  Finish the Command Line Tools installer dialog, then re-run this script."; exit 0
fi

# ---------------------------------------------------------------------------
log "Homebrew"
if ! have brew; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
persist "eval \"\$($BREW_PREFIX/bin/brew shellenv)\""
eval "$("$BREW_PREFIX/bin/brew" shellenv)"

log "Bun, Node 22, Watchman, JDK 17"
brew list bun      >/dev/null 2>&1 || brew install bun
brew list node@22  >/dev/null 2>&1 || brew install node@22
brew list watchman >/dev/null 2>&1 || brew install watchman
brew list --cask temurin@17 >/dev/null 2>&1 || brew install --cask temurin@17
persist "export PATH=\"$BREW_PREFIX/opt/node@22/bin:\$PATH\""
export PATH="$BREW_PREFIX/opt/node@22/bin:$PATH"
JAVA_HOME_17="$(/usr/libexec/java_home -v 17)"
persist "export JAVA_HOME=\"$JAVA_HOME_17\""
export JAVA_HOME="$JAVA_HOME_17"
echo "  bun $(bun --version) · node $(node --version) · java $(java -version 2>&1 | head -1)"

# ---------------------------------------------------------------------------
log "Android SDK (command-line tools → platform 36, build-tools, emulator)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
mkdir -p "$ANDROID_HOME"
brew list --cask android-commandlinetools >/dev/null 2>&1 || brew install --cask android-commandlinetools
SDKMANAGER="$BREW_PREFIX/share/android-commandlinetools/cmdline-tools/latest/bin/sdkmanager"
AVDMANAGER="$BREW_PREFIX/share/android-commandlinetools/cmdline-tools/latest/bin/avdmanager"
yes 2>/dev/null | "$SDKMANAGER" --sdk_root="$ANDROID_HOME" --licenses >/dev/null || true
PKGS=("platform-tools" "platforms;android-36" "build-tools;36.0.0" "cmdline-tools;latest")
[[ $DO_EMULATOR -eq 1 ]] && PKGS+=("emulator" "system-images;android-34;google_apis;$EMU_ABI")
"$SDKMANAGER" --sdk_root="$ANDROID_HOME" "${PKGS[@]}" >/dev/null
persist "export ANDROID_HOME=\"\$HOME/Library/Android/sdk\""
persist "export ANDROID_SDK_ROOT=\"\$ANDROID_HOME\""
persist "export PATH=\"\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/emulator:\$ANDROID_HOME/cmdline-tools/latest/bin:\$PATH\""
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
if [[ $DO_EMULATOR -eq 1 ]] && ! "$AVDMANAGER" list avd 2>/dev/null | grep -q "Name: kharcha"; then
  echo no | "$AVDMANAGER" create avd -n kharcha -k "system-images;android-34;google_apis;$EMU_ABI" -d pixel_6 >/dev/null
  echo "  created emulator 'kharcha' (start with: emulator -avd kharcha)"
fi

# ---------------------------------------------------------------------------
log "Claude Code CLI"
if ! have claude; then
  curl -fsSL https://claude.ai/install.sh | bash
  persist "export PATH=\"\$HOME/.local/bin:\$PATH\""
  export PATH="$HOME/.local/bin:$PATH"
fi
echo "  $(claude --version 2>/dev/null || echo 'claude installed')"

# ---------------------------------------------------------------------------
log "Repository → $WORKDIR ($BRANCH)"
if [[ ! -d "$WORKDIR/.git" ]]; then
  mkdir -p "$(dirname "$WORKDIR")"
  git clone "$REPO_URL" "$WORKDIR"
fi
cd "$WORKDIR"
git fetch origin "$BRANCH"
if [[ -n "$(git status --porcelain)" ]]; then
  warn "working tree has local changes; leaving branch as-is"
else
  git checkout -q "$BRANCH" && git pull -q --ff-only origin "$BRANCH"
fi

log "JavaScript dependencies"
bun install --frozen-lockfile

log ".env"
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "  created .env from .env.example (Supabase URL + publishable key are pre-filled)"
  echo "  add GOOGLE_WEB_CLIENT_ID later if you want Google sign-in"
fi

# ---------------------------------------------------------------------------
log "Upload keystore (android/app/$KEYSTORE_FILE)"
if [[ ! -f "android/app/$KEYSTORE_FILE" ]]; then
  if [[ -z "${KEYSTORE_PASSWORD:-}" ]]; then
    read -r -s -p "  choose a keystore password (min 6 chars, KEEP IT SAFE): " KEYSTORE_PASSWORD; echo
  fi
  keytool -genkeypair -v -storetype PKCS12 \
    -keystore "android/app/$KEYSTORE_FILE" -alias "$KEY_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KEYSTORE_PASSWORD" -keypass "$KEYSTORE_PASSWORD" \
    -dname "CN=Kharcha, OU=Poultry, O=Kharcha, L=Lahore, ST=Punjab, C=PK" >/dev/null
  cat > android/keystore.properties <<PROPS
storeFile=$KEYSTORE_FILE
storePassword=$KEYSTORE_PASSWORD
keyAlias=$KEY_ALIAS
keyPassword=$KEYSTORE_PASSWORD
PROPS
  echo "  keystore + android/keystore.properties written (both git-ignored)."
  echo "  BACK UP android/app/$KEYSTORE_FILE — losing it means a new upload key request to Google."
  echo
  echo "  GitHub secrets for CI signing:"
  echo "    ANDROID_KEYSTORE_BASE64 = $(base64 -i "android/app/$KEYSTORE_FILE" | tr -d '\n' | head -c 40)…  (full value: base64 -i android/app/$KEYSTORE_FILE | pbcopy)"
  echo "    KEYSTORE_PASSWORD / KEY_PASSWORD = (your password)   KEY_ALIAS = $KEY_ALIAS"
fi
echo "  SHA-1 (for Google Sign-In / Play App Signing):"
keytool -list -v -keystore "android/app/$KEYSTORE_FILE" -alias "$KEY_ALIAS" \
  -storepass "$(sed -n 's/^storePassword=//p' android/keystore.properties)" 2>/dev/null | grep -E "SHA1|SHA-1" | head -1 | sed 's/^/    /'

# ---------------------------------------------------------------------------
if [[ $DO_BUILD -eq 1 ]]; then
  log "Release build (signed APK + AAB)"
  bun run typecheck && bun run test
  (cd android && ./gradlew --quiet assembleRelease bundleRelease -PversionCode="$(git rev-list --count HEAD)" -PversionName="1.0.$(git rev-list --count HEAD)")
  echo "  APK: android/app/build/outputs/apk/release/app-release.apk"
  echo "  AAB: android/app/build/outputs/bundle/release/app-release.aab  ← upload this to Play"
fi

# ---------------------------------------------------------------------------
log "Play Store MCP for the local Claude Code session"
if [[ -n "${PLAY_MCP_URL:-}" ]]; then
  claude mcp add --transport http play-store "$PLAY_MCP_URL" ${PLAY_MCP_HEADER:+--header "$PLAY_MCP_HEADER"} || true
elif [[ -n "${PLAY_MCP_CMD:-}" ]]; then
  # shellcheck disable=SC2086
  claude mcp add --transport stdio play-store -- $PLAY_MCP_CMD || true
else
  echo "  not configured. Add it with one of:"
  echo "    PLAY_MCP_URL=https://… bash scripts/macos-setup.sh --no-build            # remote (HTTP) server"
  echo "    PLAY_MCP_CMD='npx -y <package>' bash scripts/macos-setup.sh --no-build    # local (stdio) server"
  echo "  or manually:  claude mcp add --transport http play-store <url>   (then /mcp inside claude)"
fi

# ---------------------------------------------------------------------------
log "Done"
cat <<EOM
  Next:
    source ~/.zprofile
    cd "$WORKDIR"
    claude --teleport $CLOUD_SESSION      # pulls the cloud conversation + branch into this terminal
  Useful:
    emulator -avd kharcha &   then   bun run android          # run on the emulator
    adb install -r android/app/build/outputs/apk/release/app-release.apk
    git tag -a v1.0.0 -m "First internal release" && git push origin v1.0.0   # CI → Play (once secrets exist)
EOM
if [[ $DO_TELEPORT -eq 1 ]]; then
  exec claude --teleport "$CLOUD_SESSION"
fi
