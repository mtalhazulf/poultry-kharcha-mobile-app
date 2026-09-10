# Supabase setup

Everything server-side lives in one migration:
`supabase/migrations/20260910120000_init_kharcha.sql`. It is idempotent
(`create ... if not exists`, `drop policy if exists`, `on conflict`), so it is
safe to re-run.

## Applying the migration

**Project `ikiepqpfhmdprqezrbgq`** (the one in `.env.example`): already
applied via the Supabase MCP server. Nothing to do unless you change the file.

**Any other project**, pick one:

```sh
# Supabase CLI (recommended; keeps migration history in sync)
supabase login
supabase link --project-ref <your-project-ref>
supabase db push            # or: bun run db:push
```

or open the SQL editor in the dashboard, paste the whole file and run it.

## What the migration creates

### Tables

| Table | Purpose |
| --- | --- |
| `public.profiles` | One row per auth user: `id`, `email`, generated `email_lower`, `display_name`, `avatar_url`, `created_at`. Powers share-by-email search. |
| `public.kharcha` | Expenses: `owner_id`, `amount numeric(12,2)`, `category`, `note`, `expense_date date`, `receipt_path`, `visibility` (CHECK `private`/`shared`), timestamps. |
| `public.kharcha_shares` | `(kharcha_id, shared_with)` primary key plus `shared_by`. One row per recipient. |

### Indexes

- `idx_kharcha_owner (owner_id, expense_date desc)` — the dashboard list
- `idx_shares_user (shared_with)` — "shared with me"
- `idx_shares_kharcha (kharcha_id)` — share lookups and the FK cascade
- `idx_profiles_email_lower_trgm` — GIN trigram index for `ilike '%term%'`
  search (needs the `pg_trgm` extension, created in the `extensions` schema)

### Triggers and functions

- `set_updated_at()` — `kharcha_set_updated_at` keeps `updated_at` fresh.
- `handle_new_user()` (SECURITY DEFINER) — `on_auth_user_created` inserts a
  profile row for every new `auth.users` row, pulling `display_name` /
  `avatar_url` from Google metadata when present.
- `handle_user_email_change()` — `on_auth_user_email_updated` mirrors email
  changes into `profiles`.
- `safe_uuid(text)`, `can_access_kharcha(uuid)`, `owns_kharcha(uuid)` —
  helpers for the storage policies (only `authenticated` may execute them).

### RLS policies

All three tables have RLS enabled; `anon` has every privilege revoked.

| Table | Policy | Rule |
| --- | --- | --- |
| profiles | `profiles_select` | any authenticated user (directory for sharing) |
| profiles | `profiles_insert_own` | `id = auth.uid()` |
| profiles | `profiles_update_own` | `id = auth.uid()` |
| kharcha | `kharcha_select` | owner, or a row exists in `kharcha_shares` for the caller |
| kharcha | `kharcha_insert` | `owner_id = auth.uid()` |
| kharcha | `kharcha_update` | owner only; `with check` prevents changing `owner_id` |
| kharcha | `kharcha_delete` | owner only |
| kharcha_shares | `shares_select` | recipient, or owner of the expense |
| kharcha_shares | `shares_insert` | owner of the expense, and `shared_by = auth.uid()` |
| kharcha_shares | `shares_delete` | owner of the expense |

Recipients have **no** update/delete policy on `kharcha`, so they are
read-only regardless of what the UI shows.

### Storage

- Private bucket `receipts` (10 MB limit; jpeg/png/webp/heic/pdf).
- Object key convention: `{kharcha_id}/{filename}`; `kharcha.receipt_path`
  stores that key.
- Policies on `storage.objects`: `receipts_select` (owner or share
  recipient), `receipts_insert` / `receipts_update` / `receipts_delete`
  (owner only). The first path segment is parsed as the expense id.
- The app never uses public URLs; it calls `createSignedUrl` and the policy
  above decides whether the caller may mint one.

### Realtime

`kharcha` and `kharcha_shares` are added to the `supabase_realtime`
publication. Realtime enforces RLS per subscriber for INSERT/UPDATE, but it
**cannot** for DELETE (the row is gone), so DELETE events go to every
subscriber. Replica identity is therefore left at DEFAULT: a DELETE payload
carries only the primary key, never the deleted row's contents.

> Email confirmation links redirect to `kharcha://auth/callback` with a PKCE
> `code`. That exchange only succeeds on the device that started the sign-up
> (it holds the code verifier). Opening the link elsewhere shows an auth error
> in the app, but the account is confirmed — signing in with the password works.

## Auth configuration checklist (dashboard)

Authentication -> Providers:

1. **Email** — enable. Decide on *Confirm email*:
   - On (default): users must click the link before they can sign in. The
     app shows a "check your inbox" message after sign-up.
   - Off: sign-up returns a session immediately. Convenient for testing.
2. **Google** — enable and paste the **Web application** client ID and client
   secret from Google Cloud (the same ID as `GOOGLE_WEB_CLIENT_ID` in
   `.env`). Then add the **Android** OAuth client ID under
   **Authorized Client IDs** — the native sign-in flow calls
   `supabase.auth.signInWithIdToken({ provider: 'google', token })` with an
   ID token whose audience is the web client, but Supabase also validates
   tokens issued to any listed client, which is what makes device-issued
   tokens acceptable.
   - Google Cloud side: create the Web client; create an Android client
     with package `com.kharcha.app` and the SHA-1 of each signing key
     (debug + release). See the README for the `keytool` command.
   - Set the OAuth consent screen to *External* with test users while in
     testing mode.

Authentication -> URL Configuration:

3. **Site URL** — any https URL you control (it is the fallback redirect);
   `https://ikiepqpfhmdprqezrbgq.supabase.co` is acceptable during
   development.
4. **Redirect URLs** — add `kharcha://auth/callback`. This must match
   `OAUTH_REDIRECT_URL` in `.env` and the `<intent-filter>` in
   `android/app/src/main/AndroidManifest.xml`. Without it, browser-based
   OAuth (`signInWithOAuth`) redirects to the Site URL instead of the app.

Settings -> API:

5. Copy the project URL and the publishable (anon) key into `.env`. Never put
   the `service_role` key in the app.

## Verifying RLS with two test users

Create two users (dashboard -> Authentication -> Users -> *Add user*, or sign
up twice in the app), note their UUIDs, then run this in the SQL editor. Each
block impersonates one user the same way PostgREST does.

```sql
-- Replace with the two real UUIDs
\set alice '11111111-1111-1111-1111-111111111111'
\set bob   '22222222-2222-2222-2222-222222222222'

-- Alice creates an expense
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
insert into public.kharcha (owner_id, amount, category, expense_date)
values ('11111111-1111-1111-1111-111111111111', 250.00, 'Food', current_date)
returning id;          -- keep this id
commit;

-- Bob cannot see it (expect 0 rows)
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);
select count(*) from public.kharcha;
-- Bob cannot forge an expense for Alice (expect: new row violates row-level security policy)
insert into public.kharcha (owner_id, amount, category, expense_date)
values ('11111111-1111-1111-1111-111111111111', 1, 'Food', current_date);
rollback;

-- Alice shares it with Bob
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
insert into public.kharcha_shares (kharcha_id, shared_with, shared_by)
values ('<id from above>', '22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111');
commit;

-- Bob now sees exactly one row but cannot modify it (update affects 0 rows)
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);
select id, amount from public.kharcha;                        -- 1 row
update public.kharcha set amount = 1 where id = '<id from above>';  -- UPDATE 0
delete from public.kharcha where id = '<id from above>';            -- DELETE 0
rollback;

-- Anonymous callers get nothing at all
begin;
set local role anon;
select count(*) from public.kharcha;   -- permission denied for table kharcha
rollback;
```

(`\set` lines are psql-only; in the dashboard just paste the literal UUIDs.)
Always finish with `rollback` or `commit` so the role is reset. You can also
inspect the policy list with:

```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname in ('public', 'storage')
order by tablename, policyname;
```

## Regenerating TypeScript types

`src/types/database.ts` is generated from the live schema. After changing the
migration and pushing it:

```sh
export SUPABASE_PROJECT_ID=ikiepqpfhmdprqezrbgq   # or your project ref
bun run db:types
```

(`supabase gen types typescript --project-id $SUPABASE_PROJECT_ID`, which
requires `supabase login` first.) Commit the regenerated file together with
the migration; `src/types/models.ts` narrows the generated row types into
the app models.

## Internal-app model (invite-only, roles, org categories)

Migrations `20260910170000` and `20260910180000` turn the app into a closed
staff tool. The second one supersedes the first (per-user contact lists were
replaced by invite-only sign-up); both are kept because both were applied.

### Accounts

- **Sign-up is invite-only.** A `before insert` trigger on `auth.users`
  (`enforce_invite_only`) rejects any email that is not in `public.invites`
  with `accepted_at is null`. This covers email/password *and* Google sign-in.
- **Bootstrap:** while no admin exists, the first account to sign up is let
  through and becomes `admin`. Do this right after deploying — or pre-seed
  the admin instead:

  ```sql
  insert into public.invites (email, role) values ('owner@yourfarm.com', 'admin');
  ```

  To promote an existing account: `update public.profiles set role = 'admin' where email = '…';`
- **Roles:** `profiles.role` is `admin` or `member`. A trigger
  (`guard_profile_privileges`) stops non-admins from changing `role` or
  `disabled` — even on their own row.
- **Disabling:** `profiles.disabled = true` keeps the login but every data
  policy requires `is_active_member()`, so the account sees and writes nothing.
  (Deleting the auth user needs the dashboard or service role.)

### Expense types

`public.categories` is one org-wide list (poultry defaults seeded once:
Feed, Chicks, Medicine, Vaccine, Labour, Electricity, Water, Transport,
Equipment, Repair, Bedding, Rent, Other). Everyone reads it; only admins write
(`categories_admin_write`). `kharcha.category_icon` freezes the emoji on each
expense so renaming a type later doesn't rewrite history.

### Sharing

Any active member can share with any colleague — the directory
(`profiles_select`) only ever contains invited staff.

### Smoke-test account

`demo@kharcha.test` was created before the invite gate and is a `member`.
It is what CI signs in with; it is not an admin.
