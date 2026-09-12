# MPS Expense Tracker

MPS Expense Tracker (codename "Kharcha" — "expense" in Urdu/Hindi) is an
Android expense tracker built with React Native and Supabase for
organizations that need shared, permissioned expense records. Anyone can
create an account; from there you create your own organization or join an
existing one with an invite code. Record what you spent, attach a photo of
the receipt, and share individual expenses with teammates in your
organization.

- Package name: `com.mps.expensetracker`
- Platform: Android only (no iOS project is checked in)
- Backend: Supabase project `ikiepqpfhmdprqezrbgq`
  (`https://ikiepqpfhmdprqezrbgq.supabase.co`)

> **macOS setup in one go:** `bash scripts/macos-setup.sh` (toolchain, SDK, keystore, signed build, Claude CLI).
>
> **Publishing:** see `docs/PLAY_STORE.md` (Play Console checklist, signing, store assets in `store/`).
>
> **Architecture:** see `docs/ARCHITECTURE.md` for the full build contract
> (database schema, RPCs, contexts, navigation, design system).

## Product overview

- **Open sign-up.** Anyone can create an account with email/password or
  Google. There is no invite gate on sign-up itself.
- **Organizations.** After signing in, a user with no organization lands on
  a welcome screen where they can create one (just a name) or join an
  existing one with an 8-character invite code (`XXXX-XXXX`). Joining
  creates a pending membership that an org owner or admin must approve.
  A person can belong to several organizations and switch between them
  from the header.
- **Roles.** Each organization has one owner (its creator), any number of
  admins, and members. Owners/admins see every expense in the organization
  and manage expense types, the invite code, join requests, and member
  roles/status. Members see their own expenses plus expenses explicitly
  shared with them.
- **Sharing** is scoped to the organization: you can only share an expense
  with another active member of the same org.

## Features

- Email/password and Google sign-in
- Create or join an organization (invite code with approval workflow)
- Switch between multiple organizations
- Add, edit, and delete expenses with amount, expense type, date, note, and
  an optional receipt photo
- Expense types (categories) with line icons, managed per organization
- Share expenses read-only with other active members of the same org
- Reports: totals, breakdown by category/member/day, period comparisons
- Team management: approve/decline join requests, set member roles and
  status, remove members, transfer ownership, regenerate the invite code
- Optional biometric sign-in (fingerprint/face) with an auto-lock after the
  app has been backgrounded for 60 seconds
- Offline cache for the expense list; realtime updates while online

## Architecture

| Layer | What it does |
| --- | --- |
| React Native 0.87 (New Architecture, Hermes), TypeScript strict | UI, navigation, local state |
| `@react-navigation/native-stack` + `@react-navigation/bottom-tabs` | Root stack (auth, org onboarding, lock screen) plus the main bottom-tab navigator (Expenses, Reports, Team, Settings) |
| `@supabase/supabase-js` | Auth (email/password + Google), PostgREST queries, Storage, Realtime |
| Postgres + Row Level Security | **The access-control layer.** The client never filters by organization or owner; every SELECT/INSERT/UPDATE/DELETE is scoped by the policies in `supabase/migrations/`. A compromised client cannot read or write another organization's or user's rows. |
| Private `receipts` storage bucket | Receipts are uploaded to `receipts/{kharcha_id}/{filename}`. The bucket is private; the app reads receipts through short-lived **signed URLs**, and storage policies reuse the same access rules as the `kharcha` table. |
| Realtime | Expense and Reports screens subscribe to `postgres_changes` on `kharcha` and `kharcha_shares`, filtered to the active organization; Supabase re-checks RLS per subscriber so users only receive events for rows they may read. |
| `react-native-keychain` | Stores the Supabase auth session in the Android Keystore (not AsyncStorage) and gates it behind an optional biometric prompt for the Lock screen. |
| `react-native-keyboard-controller` + `react-native-reanimated` + `react-native-worklets` | Keyboard-aware forms (focused field scrolls above the keyboard, sticky footers) and UI animations/gestures. |
| `lucide-react-native` | Line icons used throughout the UI and for expense-type icons (no emoji). |
| AsyncStorage offline cache | The last successful expense list is cached in `@react-native-async-storage/async-storage`, keyed per user and organization, so the app opens instantly and still shows data without a connection. The active organization id is also persisted here. |
| `react-native-config` | Bakes `.env` values (Supabase URL/key, Google client id, redirect URL) into the APK at build time. |

Sharing model: an expense is `private` or `shared`. Sharing adds a row to
`kharcha_shares` for another active member of the same organization;
recipients get read access to the row and its receipt but have no
update/delete policy, so they are read-only by construction.

See `docs/ARCHITECTURE.md` for the full data model, RPC list, TypeScript
contracts, navigation graph, and design system tokens.

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

The schema, RLS policies, storage bucket, realtime publication, and the
organizations/roles model live in the migrations under `supabase/migrations/`,
applied in filename order. They are already applied to the project above. To
point the app at a different project, apply the migrations and follow
[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) for the auth checklist —
no manual SQL is needed to bootstrap the first organization: just create an
account in the app and create an organization from the welcome screen.

### Google Sign-In

1. In Google Cloud Console -> APIs & Services -> Credentials create **two**
   OAuth 2.0 client IDs:
   - **Web application** — its client ID goes into `GOOGLE_WEB_CLIENT_ID` in
     `.env` and (with its secret) into the Supabase Google provider.
   - **Android** — package name `com.mps.expensetracker` plus the SHA-1 of the
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
├── docs/
│   ├── ARCHITECTURE.md          Build contract: data model, RPCs, contexts, navigation, design system
│   └── SUPABASE_SETUP.md        Backend setup, auth checklist, RLS/RPC reference
├── src/
│   ├── App.tsx                  Root component: providers + navigator
│   ├── api/                     Typed Supabase queries (organizations, members, kharcha, categories, shares, profiles, reports)
│   ├── components/              Shared composite components (e.g. AppHeader, OrgSwitcherSheet, ExpenseListItem)
│   ├── ui/                      Design-system primitives (Icon, Button, TextField, Card, ListItem, Sheet, Screen, ...) imported via the `src/ui` barrel
│   ├── context/                 AuthProvider (session), OrgProvider (memberships/active org), BiometricLockProvider (app lock + biometrics)
│   ├── hooks/                   useCategories, useKharchaList (fetch + realtime + offline cache, scoped per org)
│   ├── lib/                     Supabase client, env, auth helpers, secureStorage (Keychain), biometrics, receipts, offlineCache, errors
│   ├── navigation/               Root stack + bottom-tab param types
│   ├── screens/                 Login/SignUp, Lock, OrgWelcome/CreateOrg/JoinOrg, Expenses/Reports/Team/Settings tabs, expense form/detail, expense types, org settings, member detail
│   ├── theme/                   Design tokens (colors, spacing, radius, typography) + formatAmount/formatDate helpers
│   └── types/                   database.ts (generated), models.ts, env.d.ts
├── supabase/migrations/         Schema, RLS, triggers, storage policies, realtime, organizations model
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
    -d "kharcha://auth/callback?code=test" com.mps.expensetracker
  ```

  It must open the app (not "Activity not started"). Then make sure
  `kharcha://auth/callback` is listed in Supabase -> Authentication -> URL
  Configuration -> Redirect URLs.
- **Rows missing or writes rejected with "permission"** — that is RLS
  working as designed (organization membership, role, or status doesn't
  grant that access). See the RLS reference in `docs/SUPABASE_SETUP.md`.
- **No organization / stuck on "Waiting for approval"** — the account has no
  active membership yet. Create an organization, or ask an owner/admin of
  the target organization to approve the pending join request.
- **Gradle out of memory** — `android/gradle.properties` sets
  `-Xmx4g`; lower it on small CI runners or raise it on large builds.
- **Stale native build** — `bun run clean:android` then `bun run android`.
