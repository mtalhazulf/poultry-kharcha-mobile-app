# Kharcha

Kharcha ("expense" in Urdu/Hindi) is an Android expense tracker built with
React Native and Supabase. Record what you spent, attach a photo of the
receipt, and share individual expenses read-only with other users by email.

- Package name: `com.kharcha.app`
- Platform: Android only (no iOS project is checked in)
- Backend: Supabase project `ikiepqpfhmdprqezrbgq`
  (`https://ikiepqpfhmdprqezrbgq.supabase.co`)

> **Publishing:** see `docs/PLAY_STORE.md` (Play Console checklist, signing, store assets in `store/`).
>
> **Internal app.** Sign-up is invite-only: an admin adds staff emails in
> **Settings → Staff**; the database rejects everyone else (email *and*
> Google). The first account created becomes the admin — do that immediately
> after deploying (or pre-seed it, see `docs/SUPABASE_SETUP.md`). Expense
> types are one org-wide list (poultry defaults) that admins edit in
> **Settings → Expense types**.

## Architecture

| Layer | What it does |
| --- | --- |
| React Native 0.87 (New Architecture, Hermes), TypeScript strict | UI, navigation (`@react-navigation/native-stack`), local state |
| `@supabase/supabase-js` | Auth (email/password + Google), PostgREST queries, Storage, Realtime |
| Postgres + Row Level Security | **The access-control layer.** The client never filters by owner; every SELECT/INSERT/UPDATE/DELETE is scoped by the policies in `supabase/migrations/20260910120000_init_kharcha.sql`. A compromised client cannot read or write another user's rows. |
| Private `receipts` storage bucket | Receipts are uploaded to `receipts/{kharcha_id}/{filename}`. The bucket is private; the app reads receipts through short-lived **signed URLs**, and storage policies reuse the same owner-or-shared rule as the table. |
| Realtime | The dashboard subscribes to `postgres_changes` on `kharcha` and `kharcha_shares`; Supabase re-checks RLS per subscriber so users only receive events for rows they may read. |
| AsyncStorage offline cache | The last successful expense list is cached in `@react-native-async-storage/async-storage` so the app opens instantly and still shows data without a connection. |
| `react-native-config` | Bakes `.env` values (Supabase URL/key, Google client id, redirect URL) into the APK at build time. |

Sharing model: an expense is `private` or `shared`. Sharing adds a row to
`kharcha_shares`; recipients get read access to the row and its receipt but
have no update/delete policy, so they are read-only by construction.

## Prerequisites

- [Bun](https://bun.sh) >= 1.2 (package manager and script runner)
- Node 22 (Metro and the React Native CLI run on Node)
- JDK 17 or newer (AGP 9 / Gradle 9 require 17+; 21 works)
- Android SDK: platform 35+ (the project compiles against 37), build-tools,
  platform-tools, and the command-line tools. `ANDROID_HOME` must be set.
- An Android emulator (API 24+) or a physical device with USB debugging.

## Setup

```sh
bun install
cp .env.example .env
# edit .env: SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_WEB_CLIENT_ID, OAUTH_REDIRECT_URL
```

`.env` is git-ignored. Its values are compiled into the APK, so **any change
to `.env` needs a rebuild** (`bun run android`), not just a Metro reload.

### Supabase

The schema, RLS policies, storage bucket and realtime publication live in a
single migration under `supabase/migrations/`. It is already applied to the
project above. To point the app at a different project, or to configure Auth
providers and redirect URLs, follow [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

### Google Sign-In

1. In Google Cloud Console -> APIs & Services -> Credentials create **two**
   OAuth 2.0 client IDs:
   - **Web application** — its client ID goes into `GOOGLE_WEB_CLIENT_ID` in
     `.env` and (with its secret) into the Supabase Google provider.
   - **Android** — package name `com.kharcha.app` plus the SHA-1 of the
     signing certificate. For debug builds:

     ```sh
     keytool -list -v -keystore android/app/debug.keystore \
       -alias androiddebugkey -storepass android -keypass android
     ```

     Add a second Android client (or a second SHA-1) for your release
     keystore. Google resolves the Android client from the signing
     certificate; it is never referenced in code.
2. In Supabase -> Authentication -> Providers -> Google enable the provider
   with the **Web** client ID and secret, and list the Android client ID under
   "Authorized Client IDs" so `signInWithIdToken` accepts tokens minted on
   the device.
3. `google-services.json` is **not** required. There is no Firebase in this
   app; `@react-native-google-signin/google-signin` works from the OAuth
   clients alone.

## Run

```sh
bun run start      # Metro bundler
bun run android    # build the debug APK and install it on the running emulator/device
```

## Build an APK

| Command | Output |
| --- | --- |
| `bun run apk:debug` | `android/app/build/outputs/apk/debug/app-debug.apk` |
| `bun run apk:release` | `android/app/build/outputs/apk/release/app-release.apk` |
| `bun run bundle:release` | `android/app/build/outputs/bundle/release/app-release.aab` (Play Store) |

Release builds run R8 (minify + resource shrinking) with the rules in
`android/app/proguard-rules.pro`.

### Release signing

Copy `android/keystore.properties.example` to `android/keystore.properties`
and point it at your keystore (both the properties file and `*.keystore`
files are git-ignored; the example file documents the `keytool` command).
If `keystore.properties` is missing, `apk:release` still succeeds but signs
with the debug keystore and prints a warning — fine for CI smoke builds,
never for distribution.

## Scripts

| Script | Description |
| --- | --- |
| `bun run start` | Start Metro |
| `bun run android` | Build + install debug app on device/emulator |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint over the whole repo |
| `bun run test` | Jest unit tests (`bunx jest` also works) |
| `bun run apk:debug` | `gradlew assembleDebug` |
| `bun run apk:release` | `gradlew assembleRelease` |
| `bun run bundle:release` | `gradlew bundleRelease` (AAB) |
| `bun run clean:android` | `gradlew clean` |
| `bun run db:types` | Regenerate `src/types/database.ts` from the live schema (`SUPABASE_PROJECT_ID` must be set) |
| `bun run db:push` | Apply local migrations with the Supabase CLI |

## Project structure

```
.
├── android/                     Native Android project (Gradle, manifest, keystore template)
│   ├── app/build.gradle         react-native-config plugin, release signing, R8
│   ├── app/proguard-rules.pro   Keep rules for config/Google Sign-In/image picker
│   └── keystore.properties.example
├── docs/SUPABASE_SETUP.md       Backend setup, auth checklist, RLS verification
├── src/
│   ├── App.tsx                  Root component: providers + navigator
│   ├── api/                     Typed Supabase queries (kharcha, profiles, shares)
│   ├── components/              Reusable UI (ui.tsx primitives, ExpenseListItem)
│   ├── context/                 AuthProvider (session, sign-in/out)
│   ├── hooks/                   useKharchaList (fetch + realtime + offline cache)
│   ├── lib/                     supabase client, env, auth helpers, receipts, offlineCache, errors
│   ├── navigation/              Route param types
│   ├── screens/                 Login, Dashboard, Add/Edit expense, Share modal, ...
│   ├── theme/                   Design tokens + formatAmount/formatDate helpers
│   └── types/                   database.ts (generated), models.ts, env.d.ts
├── supabase/migrations/         Schema, RLS, triggers, storage policies, realtime
├── __tests__/                   Jest unit tests
├── __mocks__/                   react-native-config test fixture
├── jest.config.js / jest.setup.ts
└── .github/workflows/android.yml  CI: typecheck, lint, test, release APK
```

## Troubleshooting

- **Config values are empty / "Missing SUPABASE_URL"** — `.env` is read at
  build time. Rebuild the app after editing it. Check the Gradle output for
  `Reading env from: .env`.
- **Google Sign-In fails with `DEVELOPER_ERROR`** — the SHA-1 + package name
  of the APK you installed does not match an Android OAuth client, or
  `GOOGLE_WEB_CLIENT_ID` is not the *Web* client. Re-run the `keytool`
  command above and compare.
- **Browser sign-in never returns to the app** — verify the deep link is
  registered and reachable:

  ```sh
  adb shell am start -W -a android.intent.action.VIEW \
    -d "kharcha://auth/callback?code=test" com.kharcha.app
  ```

  It must open Kharcha (not "Activity not started"). Then make sure
  `kharcha://auth/callback` is listed in Supabase -> Authentication -> URL
  Configuration -> Redirect URLs.
- **Rows missing or writes rejected with "permission"** — that is RLS
  working as designed. See the verification section in
  `docs/SUPABASE_SETUP.md` to check policies with two test users.
- **Gradle out of memory** — `android/gradle.properties` sets
  `-Xmx4g`; lower it on small CI runners or raise it on large builds.
- **Stale native build** — `bun run clean:android` then `bun run android`.
