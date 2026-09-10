# Publishing Kharcha to Google Play

Kharcha is an internal staff app, so the recommended track is **Internal
testing** (up to 100 tester emails, no public listing, no review queue) or
plain **sideloading** of the APK. Production is possible but adds review,
a public listing and the Data-safety questionnaire.

## What is already prepared in this repo

| Item | Where |
|---|---|
| Play-ready **App Bundle** (`.aab`) built on every push | CI artifact `app-release-bundle-<sha>` |
| Sideload **APK** | CI artifact `app-release-<sha>` |
| Launcher icon (adaptive + legacy) | `android/app/src/main/res/mipmap-*` |
| Play icon 512×512 | `store/play-icon-512.png` |
| Feature graphic 1024×500 | `store/feature-graphic-1024x500.png` |
| Phone screenshots (1080×2160, 2:1) | `store/screenshots/*.png` |
| Privacy policy text | `docs/PRIVACY.md` (host it at a public URL) |
| Release signing hook | `android/app/build.gradle` reads `android/keystore.properties`; CI reads the `ANDROID_KEYSTORE_BASE64` secret |
| Permissions | `INTERNET`, `CAMERA` only (Photo Picker needs none) |
| `applicationId` | `com.kharcha.app` — **cannot be changed after the first upload** |
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
   names and photos.
4. **Store listing copy** — app name "Kharcha", short description (≤80
   chars), full description, support email, category (Business / Finance).
5. **Google Sign-In (optional)** — the SHA-1 of the *upload* key **and** of
   the *Play App Signing* key (Play Console → Setup → App signing) both need
   an Android OAuth client in Google Cloud, plus the Web client ID in `.env`
   / CI secrets. Without this, email + password login still works.

## Console steps (once the above exists)

1. Create app → "Kharcha", App, Free, accept policies.
2. **Setup → App signing**: keep Play App Signing on.
3. **Policy → App content**: privacy policy URL; ads = No; target audience =
   18+; content rating questionnaire (Utility → no sensitive content);
   Data safety: collects *Email address, Name, Photos* (receipts) and
   *User IDs*; encrypted in transit = Yes; users can request deletion = Yes
   (admin disables/deletes account); not shared with third parties.
   Government apps / financial features = No; Health = No.
4. **Testing → Internal testing → Create release**: upload the `.aab` from
   the CI artifact, add release notes, add tester emails (your staff),
   review and roll out. Testers install via the opt-in link.
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
   information** on Kharcha.
2. Upload the **first** AAB manually once (the API cannot create the app or
   its first release).
3. Add the GitHub secret `PLAY_SERVICE_ACCOUNT_JSON` (the key file contents)
   alongside the keystore secrets.
4. Release = push a tag: `git tag -a v1.0.1 -m "Fixes …" && git push origin v1.0.1`.
   CI builds, runs the emulator smoke test, then uploads to **Internal
   testing** with the tag message as release notes. `versionName` comes from
   the tag, `versionCode` from the CI run number (always increasing).
