# Publishing MPS Expense Tracker to Google Play

MPS Expense Tracker now supports open sign-up with multi-organization
accounts, so **Production** (or **Closed/Open testing**) is the natural
track — there is no invite gate to work around. **Internal testing** (up to
100 tester emails) still works well for pre-release QA: a tester creates an
account and their own organization, no invite from you required.

## What is already prepared in this repo

| Item | Where |
|---|---|
| Play-ready **App Bundle** (`.aab`) built on every push | CI artifact `app-release-bundle-<sha>` |
| Sideload **APK** | CI artifact `app-release-<sha>` |
| Launcher icon (adaptive + legacy) | `android/app/src/main/res/mipmap-*` |
| Play icon 512×512 | `store/play-icon-512.png` |
| Feature graphic 1024×500 | `store/feature-graphic-1024x500.png` |
| Phone screenshots (1080×2160, 2:1) | `store/screenshots/*.png` — **retake after the enterprise UI redesign** (bottom tabs, org switcher, new expense-type icons); the current set was captured before the redesign and no longer reflects the app. |
| Privacy policy text | `docs/PRIVACY.md` (host it at a public URL) |
| Release signing hook | `android/app/build.gradle` reads `android/keystore.properties`; CI reads the `ANDROID_KEYSTORE_BASE64` secret |
| Permissions | `INTERNET`, `CAMERA` only (Photo Picker needs none) |
| `applicationId` | `com.mps.expensetracker` — **cannot be changed after the first upload** |
| `targetSdkVersion` | 36 (meets Play's current requirement) |

## What only you can provide

1. **Google Play Console account** — https://play.google.com/console, one-time
   USD 25, identity verification. For an organisation account Google asks
   for a D-U-N-S number and a company website/email.
2. **Upload keystore** (kept by you, never committed):
   ```bash
   keytool -genkeypair -v -storetype PKCS12 \
     -keystore kharcha-upload.keystore -alias kharcha \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
   Then either put it at `android/app/kharcha-upload.keystore` + copy
   `android/keystore.properties.example` → `android/keystore.properties`,
   or add these GitHub secrets so CI signs the bundle:
   `ANDROID_KEYSTORE_BASE64` (`base64 -w0 kharcha-upload.keystore`),
   `KEYSTORE_PASSWORD`, `KEY_ALIAS` (`kharcha`), `KEY_PASSWORD`.
   Enrol in **Play App Signing** when creating the app (default) — Google
   holds the final signing key; yours is only the upload key.
3. **Privacy policy URL** — publish `docs/PRIVACY.md` anywhere public
   (GitHub Pages, your website). Required because the app collects email,
   names, organization membership, and photos.
4. **Store listing copy** — app name "MPS Expense Tracker", short
   description (≤80 chars), full description, support email, category
   (Business / Finance). Suggested copy:
   - **Short description**: "Track and share team expenses, organized by
     company."
   - **Full description**: cover — open sign-up (email or Google); create
     your own organization or join one with an invite code; owners/admins
     see all organization expenses and manage members and expense types;
     members track their own expenses and share individual ones with
     teammates; receipt photos; reports by category, member, and day;
     optional biometric app lock.
5. **Google Sign-In (optional)** — the SHA-1 of the *upload* key **and** of
   the *Play App Signing* key (Play Console → Setup → App signing) both need
   an Android OAuth client in Google Cloud, plus the Web client ID in `.env`
   / CI secrets. Without this, email + password login still works.

## Console steps (once the above exists)

1. Create app → "MPS Expense Tracker", App, Free, accept policies.
2. **Setup → App signing**: keep Play App Signing on.
3. **Policy → App content**: privacy policy URL; ads = No; target audience =
   18+; content rating questionnaire (Utility → no sensitive content).
   **Data safety** section:
   - Collects: *Email address*, *Name* (display name), *User IDs*, *Photos*
     (receipts), *App activity* (expense records, organization membership).
   - **Biometric data**: not collected — processed on-device only, used for
     app unlock. Select "Not collected" and, where the form offers it, note
     that biometric authentication is handled by the Android platform and
     no biometric data is transmitted to or stored by the app's servers.
   - Encrypted in transit = Yes. Users can request data deletion = Yes (in
     app: leave an organization; by request: contact support, see
     `docs/PRIVACY.md`).
   - Data shared with third parties = No. Government apps / financial
     features = No. Health = No.
4. **Testing → (Internal/Closed/Open) testing → Create release**: upload the
   `.aab` from the CI artifact, add release notes, add testers if using
   Internal/Closed testing, review and roll out.
   - **Testing note for reviewers**: no invite is required to evaluate the
     app end to end. Create an account (email/password or Google), then on
     the welcome screen choose **Create organization** and enter any name —
     this gives full owner access to explore expenses, reports, team
     management, and settings without needing an invite code from us. An
     invite code can additionally be provided on request to test the
     join/approve flow between two accounts.
5. Each new upload needs a higher `versionCode` in
   `android/app/build.gradle` (`versionCode 1` today).

## Sideloading instead of Play

Download `app-release-<sha>` from the latest green workflow run, unzip, and
install `app-release.apk` on each phone (allow "install unknown apps").
Signed with the debug key until a keystore is configured; that is fine for
sideloading but a device will refuse an upgrade if the signing key later
changes — set up the keystore before handing phones out.

## Automated upload (Google Play Developer API)

There is no Play Console MCP/connector, but the workflow can publish for you:

1. In Play Console → **Users and permissions** → *Invite new users* →
   choose a **service account** (create one in Google Cloud → IAM → Service
   accounts, with a JSON key; enable the *Google Play Android Developer API*
   on that project). Give it **Release to testing tracks** + **View app
   information** on MPS Expense Tracker.
2. Upload the **first** AAB manually once (the API cannot create the app or
   its first release).
3. Add the GitHub secret `PLAY_SERVICE_ACCOUNT_JSON` (the key file contents)
   alongside the keystore secrets.
4. Release = push a tag: `git tag -a v1.0.1 -m "Fixes …" && git push origin v1.0.1`.
   CI builds, runs the emulator smoke test, then uploads to **Internal
   testing** with the tag message as release notes. `versionName` comes from
   the tag, `versionCode` from the CI run number (always increasing).
