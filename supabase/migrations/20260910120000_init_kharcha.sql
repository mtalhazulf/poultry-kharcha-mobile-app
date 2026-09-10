-- ============================================================================
-- Kharcha — initial schema, RLS, auth trigger and storage policies
-- ============================================================================
-- Access control lives entirely in this file. The React Native client never
-- filters by owner: every SELECT/INSERT/UPDATE/DELETE is scoped by the
-- policies below, so a compromised client cannot read or write another
-- user's rows.
-- ============================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  email_lower  text generated always as (lower(email)) stored,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create table if not exists public.kharcha (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  amount       numeric(12, 2) not null,
  category     text not null,
  note         text,
  expense_date date not null,
  receipt_path text,
  visibility   text not null default 'private'
                 check (visibility in ('private', 'shared')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.kharcha_shares (
  kharcha_id  uuid not null references public.kharcha (id) on delete cascade,
  shared_with uuid not null references public.profiles (id) on delete cascade,
  shared_by   uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (kharcha_id, shared_with)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_kharcha_owner
  on public.kharcha (owner_id, expense_date desc);

create index if not exists idx_shares_user
  on public.kharcha_shares (shared_with);

-- Supports the `shares_select` / `shares_delete` policies, which look up a
-- share by kharcha_id, and the FK cascade from kharcha.
create index if not exists idx_shares_kharcha
  on public.kharcha_shares (kharcha_id);

-- Share-modal search runs `email_lower ilike '%term%'`; a btree index cannot
-- serve a leading wildcard, so use trigrams.
create index if not exists idx_profiles_email_lower_trgm
  on public.profiles using gin (email_lower extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kharcha_set_updated_at on public.kharcha;
create trigger kharcha_set_updated_at
  before update on public.kharcha
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profile provisioning on signup
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so the insert bypasses RLS (the row is created before the
-- user has a session). search_path is pinned so the function cannot be
-- hijacked by a shadowing object in a caller-controlled schema.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ), ''),
    nullif(coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in step when a user changes their address in auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Backfill profiles for users that already exist (no-op on a fresh project).
insert into public.profiles (id, email)
select u.id, coalesce(u.email, '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- auth.uid() is wrapped in a scalar subquery throughout: Postgres then
-- evaluates it once per statement (initplan) instead of once per row, which
-- is the difference between an index scan and a seq scan on large tables.
-- Semantics are identical.

alter table public.profiles       enable row level security;
alter table public.kharcha        enable row level security;
alter table public.kharcha_shares enable row level security;

-- profiles ------------------------------------------------------------------
-- Every signed-in user can read the profile directory; this is what powers
-- "share with someone by email". Nothing sensitive beyond email/display name
-- lives on this table.

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using ((select auth.role()) = 'authenticated');

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Lets the client self-heal a missing profile row (e.g. a user created before
-- the trigger existed). Still limited to the caller's own id.
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

-- kharcha -------------------------------------------------------------------

drop policy if exists kharcha_select on public.kharcha;
create policy kharcha_select on public.kharcha
  for select to authenticated
  using (
    (select auth.uid()) = owner_id
    or exists (
      select 1
      from public.kharcha_shares s
      where s.kharcha_id = kharcha.id
        and s.shared_with = (select auth.uid())
    )
  );

drop policy if exists kharcha_insert on public.kharcha;
create policy kharcha_insert on public.kharcha
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

-- `with check` mirrors `using` so an owner cannot hand a row to someone else
-- by updating owner_id.
drop policy if exists kharcha_update on public.kharcha;
create policy kharcha_update on public.kharcha
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists kharcha_delete on public.kharcha;
create policy kharcha_delete on public.kharcha
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- kharcha_shares ------------------------------------------------------------
-- Recipients are read-only by construction: they get no update/delete policy
-- on kharcha, so RLS rejects their writes regardless of what the UI shows.

drop policy if exists shares_select on public.kharcha_shares;
create policy shares_select on public.kharcha_shares
  for select to authenticated
  using (
    (select auth.uid()) = shared_with
    or (select auth.uid()) = (
      select k.owner_id from public.kharcha k where k.id = kharcha_id
    )
  );

drop policy if exists shares_insert on public.kharcha_shares;
create policy shares_insert on public.kharcha_shares
  for insert to authenticated
  with check (
    (select auth.uid()) = (
      select k.owner_id from public.kharcha k where k.id = kharcha_id
    )
    -- shared_by must be the caller, so a share cannot be attributed to
    -- someone else.
    and (select auth.uid()) = shared_by
  );

drop policy if exists shares_delete on public.kharcha_shares;
create policy shares_delete on public.kharcha_shares
  for delete to authenticated
  using (
    (select auth.uid()) = (
      select k.owner_id from public.kharcha k where k.id = kharcha_id
    )
  );

-- ---------------------------------------------------------------------------
-- Grants — anon never touches these tables; RLS gates `authenticated`.
-- ---------------------------------------------------------------------------

revoke all on public.profiles       from anon;
revoke all on public.kharcha        from anon;
revoke all on public.kharcha_shares from anon;

grant select, insert, update          on public.profiles       to authenticated;
grant select, insert, update, delete  on public.kharcha        to authenticated;
grant select, insert, delete          on public.kharcha_shares to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime — the dashboard subscribes to postgres_changes on these tables.
-- Realtime re-checks RLS per subscriber, so a user only receives events for
-- rows they may read.
-- ---------------------------------------------------------------------------

alter table public.kharcha        replica identity full;
alter table public.kharcha_shares replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'kharcha'
    ) then
      alter publication supabase_realtime add table public.kharcha;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'kharcha_shares'
    ) then
      alter publication supabase_realtime add table public.kharcha_shares;
    end if;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Storage — private `receipts` bucket
-- ---------------------------------------------------------------------------
-- Object key convention: {kharcha_id}/{filename}
-- (full path, including the bucket, is receipts/{kharcha_id}/{filename}).
-- kharcha.receipt_path stores the key without the bucket prefix.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A storage object whose first path segment is not a uuid would make the
-- policy expression raise 22P02 and fail the whole query, so cast defensively.
create or replace function public.safe_uuid(value text)
returns uuid
language plpgsql
immutable
returns null on null input
as $$
begin
  return value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

-- Storage policies cannot join to application tables directly, so the
-- owned-or-shared check is packaged as a SECURITY DEFINER helper.
create or replace function public.can_access_kharcha(k_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.kharcha
    where id = k_id and owner_id = auth.uid()
  ) or exists (
    select 1 from public.kharcha_shares
    where kharcha_id = k_id and shared_with = auth.uid()
  );
$$;

create or replace function public.owns_kharcha(k_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.kharcha
    where id = k_id and owner_id = auth.uid()
  );
$$;

revoke execute on function public.can_access_kharcha(uuid) from public, anon;
revoke execute on function public.owns_kharcha(uuid)       from public, anon;
grant  execute on function public.can_access_kharcha(uuid) to authenticated;
grant  execute on function public.owns_kharcha(uuid)       to authenticated;

-- Owner or share recipient may read (signed URLs are minted through this).
drop policy if exists receipts_select on storage.objects;
create policy receipts_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and public.can_access_kharcha(
      public.safe_uuid((storage.foldername(name))[1])
    )
  );

-- Only the owner of the expense may upload under its folder.
drop policy if exists receipts_insert on storage.objects;
create policy receipts_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and public.owns_kharcha(
      public.safe_uuid((storage.foldername(name))[1])
    )
  );

-- Needed for upsert-style replacement when a receipt is swapped on edit.
drop policy if exists receipts_update on storage.objects;
create policy receipts_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipts'
    and public.owns_kharcha(
      public.safe_uuid((storage.foldername(name))[1])
    )
  )
  with check (
    bucket_id = 'receipts'
    and public.owns_kharcha(
      public.safe_uuid((storage.foldername(name))[1])
    )
  );

-- Needed so deleting an expense (or clearing its receipt) also removes the
-- stored object instead of orphaning it.
drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and public.owns_kharcha(
      public.safe_uuid((storage.foldername(name))[1])
    )
  );
