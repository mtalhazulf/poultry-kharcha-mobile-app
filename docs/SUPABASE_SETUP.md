# Supabase setup

Everything server-side lives in migrations under `supabase/migrations/`,
applied in filename order:

1. `20260910120000_init_kharcha.sql` — base schema: `profiles`, `kharcha`,
   `kharcha_shares`, storage, realtime.
2. `20260910130000_hardening_advisors.sql`,
   `20260910140000_fix_policy_recursion.sql`,
   `20260910150000_realtime_replica_identity_default.sql` — RLS hardening and
   fixes on top of the base schema.
3. `20260910170000_categories_and_trusted_contacts.sql`,
   `20260910180000_internal_app_model.sql`,
   `20260910190000_seed_admin_invite.sql` — an earlier invite-only, single
   organization model. Superseded by the migration below; kept because they
   were applied historically.
4. `20260911120000_organizations.sql` — the current model: multi-organization
   accounts, roles, and per-organization data. This is the source of truth
   for the schema described below; see `docs/ARCHITECTURE.md` for the full
   build contract.
5. `20260912040000_expense_history_and_org_visibility.sql` — drops the
   per-recipient sharing model (`kharcha_shares`, `visibility`) in favor of
   plain org-wide expense visibility, and adds `kharcha_history` (a version
   snapshot on every real edit, via the `kharcha_snapshot_history` trigger).
6. `20260912050000_org_currency_rpc.sql` — `set_organization_currency`, an
   admin-only RPC so an org's currency is editable after creation.

Migrations are idempotent (`create ... if not exists`, `drop policy if
exists`, `on conflict`), so they are safe to re-run.

## Applying the migrations

**Project `ikiepqpfhmdprqezrbgq`** (the one in `.env.example`): already
applied via the Supabase MCP server. Nothing to do unless you change a file.

**Any other project**, pick one:

```sh
# Supabase CLI (recommended; keeps migration history in sync)
supabase login
supabase link --project-ref <your-project-ref>
supabase db push            # or: bun run db:push
```

or open the SQL editor in the dashboard and run each file in order.

**Bootstrapping the first organization needs no SQL.** Once the migrations
are applied and Auth is configured (see below), create an account in the app
and, on the welcome screen, choose **Create organization**. That account
becomes the organization's owner automatically.

## Data model

### Core tables

| Table | Purpose |
| --- | --- |
| `public.profiles` | One row per auth user: `id`, `email`, `display_name`, `avatar_url`, `created_at`. No `role` or `disabled` column — access is per-organization, not global. |
| `public.organizations` | `id`, `name`, `currency` (default `PKR`), `created_by`, timestamps. |
| `public.organization_invite_codes` | One row per org: an 8-character invite code (`code ~ '^[A-HJ-NP-Z2-9]{8}$'`, shown to users as `XXXX-XXXX`), visible/manageable by admins only. |
| `public.organization_members` | `(org_id, user_id)` primary key: `role` (`owner`/`admin`/`member`), `status` (`active`/`pending`/`disabled`), request/approval timestamps. Exactly one `owner` per org (partial unique index). |
| `public.categories` | Expense types, now scoped per organization: `org_id`, `name`, `icon` (a lucide icon key, e.g. `wheat`, `egg`, `pill` — no emoji), `sort_order`, `active`. |
| `public.kharcha` | Expenses, now scoped per organization: `org_id`, `owner_id`, `amount numeric(12,2)`, `category`, `category_icon` (icon key frozen at creation time), `note`, `expense_date date`, `receipt_path`, `visibility` (`private`/`shared`), timestamps. `org_id` cannot change after insert. |
| `public.kharcha_shares` | `(kharcha_id, shared_with)` primary key plus `shared_by`. Sharing is only allowed with another active member of the same organization as the expense. |

The old `public.invites` table and the invite-only sign-up gate are gone —
anyone can create an account. There is no global admin role or org-wide
category list; everything is scoped to an organization the user belongs to.

### Helper functions (security definer, stable, `set search_path = ''`)

- `is_org_member(p_org)` — caller is an **active** member of the org.
- `is_org_admin(p_org)` — caller is an active `owner` or `admin` of the org.
- `has_org_membership(p_org)` — caller has any membership row (including
  `pending`/`disabled`).
- `shares_org_with(p_user)` — both users are active in the same org, or the
  caller is an admin of an org where `p_user` has any membership.
- `is_shared_with_me(p_kharcha)` — a `kharcha_shares` row exists for the
  caller on that expense.
- `owns_kharcha(p_kharcha)` — caller owns the expense and is an active
  member of its org.
- `can_access_kharcha(p_kharcha)` — caller is an active member of the org
  and (owns it, or is an org admin, or it's shared with them).
- `generate_invite_code()` (volatile) — generates a random 8-character code.

### Row Level Security

RLS is enabled on every table; `anon` has all privileges revoked. Writes to
`organizations`, `organization_invite_codes`, and `organization_members` go
through RPCs only — there are no direct insert/update/delete policies on
those tables.

| Table | Select | Write |
| --- | --- | --- |
| `organizations` | `has_org_membership(id)` | none (RPC only) |
| `organization_invite_codes` | `is_org_admin(org_id)` | none (RPC only) |
| `organization_members` | own row, or admin of the org, or an active member of the org viewing an active row | none (RPC only) |
| `profiles` | own row, or `shares_org_with(id)` | insert/update own row |
| `categories` | `is_org_member(org_id)` | insert/update/delete: `is_org_admin(org_id)` |
| `kharcha` | `is_org_member(org_id) and (owner_id = auth.uid() or is_org_admin(org_id) or is_shared_with_me(id))` | insert/update: owner and active member; delete: owner or org admin |
| `kharcha_shares` | recipient or the expense's owner (active) | insert: owner, `shared_by = auth.uid()`, recipient must be an active member of the same org; delete: owner |
| storage `receipts` | `can_access_kharcha(safe_uuid(folder[1]))` | `owns_kharcha(safe_uuid(folder[1]))` |

Recipients of a shared expense have **no** update/delete policy on
`kharcha`, so they are read-only regardless of what the UI shows.

### RPCs

All RPCs are `security definer` (except `report_summary`, which is
`security invoker` so RLS decides what gets counted) and execute is granted
to `authenticated` only.

| Function | Returns | Rules |
| --- | --- | --- |
| `create_organization(p_name text)` | `organizations` row | Caller becomes the active owner; an invite code is generated; default expense types are seeded. |
| `request_to_join(p_code text)` | `json {org_id, org_name, status}` | Unknown code raises `P0002` ("Invite code not found"); an existing membership returns its current status instead of creating a new one; a `disabled` membership raises `42501`. |
| `approve_join_request(p_org, p_user)` | void | Admin only; moves a `pending` membership to `active`. |
| `decline_join_request(p_org, p_user)` | void | Admin only; deletes the `pending` row. |
| `set_member_role(p_org, p_user, p_role)` | void | Admin only; `p_role` is `admin` or `member`; cannot target the owner or the caller's own row. |
| `set_member_status(p_org, p_user, p_status)` | void | Admin only; `p_status` is `active` or `disabled`; cannot target the owner, the caller's own row, or a `pending` row. |
| `remove_member(p_org, p_user)` | void | Admin only; cannot target the owner or the caller's own row. |
| `leave_organization(p_org)` | void | Removes the caller's own membership (or cancels a pending request); the owner cannot leave. |
| `transfer_ownership(p_org, p_user)` | void | Owner only; target must be active; target becomes owner, caller becomes admin. |
| `rename_organization(p_org, p_name)` | void | Admin only. |
| `regenerate_invite_code(p_org)` | text | Admin only; returns the new code. |
| `report_summary(p_org, p_from date, p_to date)` | json (`ReportSummary`, see `docs/ARCHITECTURE.md`) | Security invoker — visibility follows the caller's `kharcha` RLS, so members only see totals for expenses they can already read. |

Errors use clear messages with the matching SQLSTATE: `42501` permission,
`P0002` not found, `23514` validation, `23505` duplicate.

### Storage

- Private bucket `receipts` (10 MB limit; jpeg/png/webp/heic/pdf).
- Object key convention: `{kharcha_id}/{filename}`; `kharcha.receipt_path`
  stores that key. Keys are unchanged by the organizations migration.
- The app never uses public URLs; it calls `createSignedUrl`, and the
  `can_access_kharcha` / `owns_kharcha` policies above decide whether the
  caller may mint one.

### Realtime

`kharcha` and `kharcha_shares` are in the `supabase_realtime` publication.
Clients subscribe filtered to the active organization
(`org_id=eq.<org>`). Realtime enforces RLS per subscriber for
INSERT/UPDATE, but it **cannot** for DELETE (the row is gone), so DELETE
events go to every subscriber of the channel. Replica identity is therefore
left at DEFAULT: a DELETE payload carries only the primary key, never the
deleted row's contents.

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
     with package `com.mps.expensetracker` and the SHA-1 of each signing key
     (debug + release). See the README for the `keytool` command.
   - Set the OAuth consent screen to *External* with test users while in
     testing mode.

There is no invite-only gate to configure — sign-up is open to anyone who
completes email or Google auth. Access to an organization's data is granted
separately, after sign-up, via `create_organization` or
`request_to_join` + approval.

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

## Verifying RLS with two test users and two organizations

Create two users (dashboard -> Authentication -> Users -> *Add user*, or sign
up twice in the app), note their UUIDs, then run this in the SQL editor. Each
block impersonates one user the same way PostgREST does.

```sql
-- Replace with the two real UUIDs
\set alice '11111111-1111-1111-1111-111111111111'
\set bob   '22222222-2222-2222-2222-222222222222'

-- Alice creates an organization and an expense in it
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
select create_organization('Alice Co');   -- keep the returned org id
insert into public.kharcha (org_id, owner_id, amount, category, expense_date)
values ('<org id from above>', '11111111-1111-1111-1111-111111111111', 250.00, 'Food', current_date)
returning id;          -- keep this id
commit;

-- Bob is not a member of Alice's org and cannot see it (expect 0 rows)
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);
select count(*) from public.kharcha where org_id = '<org id from above>';
-- Bob cannot forge an expense in Alice's org (expect: new row violates row-level security policy)
insert into public.kharcha (org_id, owner_id, amount, category, expense_date)
values ('<org id from above>', '11111111-1111-1111-1111-111111111111', 1, 'Food', current_date);
rollback;

-- Bob requests to join Alice's org with its invite code, Alice approves
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true);
select request_to_join('<invite code from organization_invite_codes>');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true);
select approve_join_request('<org id from above>', '22222222-2222-2222-2222-222222222222');
commit;

-- Alice shares the expense with Bob (now an active member)
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
select id, amount from public.kharcha where org_id = '<org id from above>';  -- 1 row
update public.kharcha set amount = 1 where id = '<id from above>';          -- UPDATE 0
delete from public.kharcha where id = '<id from above>';                    -- DELETE 0
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

`src/types/database.ts` is generated from the live schema. After changing a
migration and pushing it:

```sh
export SUPABASE_PROJECT_ID=ikiepqpfhmdprqezrbgq   # or your project ref
bun run db:types
```

(`supabase gen types typescript --project-id $SUPABASE_PROJECT_ID`, which
requires `supabase login` first.) Commit the regenerated file together with
the migration; `src/types/models.ts` narrows the generated row types into
the app models described in `docs/ARCHITECTURE.md`.

## Migrating existing data

`20260911120000_organizations.sql` moves any pre-existing rows (from the
earlier single-tenant, invite-only deployment) into one organization named
**MPS**: the account that was the global admin becomes the owner, other
former admins become admins, everyone else becomes a member, and previously
disabled accounts keep `disabled` status on their membership. New projects
with no prior data simply start with zero organizations until the first
user creates one.
