-- ============================================================================
-- Per-user expense categories (poultry defaults) + trusted-contact sharing
-- ============================================================================
-- 1. Sharing was open to any registered user, and the profile directory was
--    readable by everyone. Now: a user may only share with people on their own
--    trusted list, the directory is exact-email lookup only, and removing a
--    contact revokes anything shared with them. All enforced in RLS.
-- 2. Categories are per user, seeded with poultry-farm defaults and editable
--    from the Settings screen.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 40),
  emoji      text not null default '📦' check (length(emoji) between 1 and 8),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists categories_owner_name_key
  on public.categories (owner_id, lower(btrim(name)));
create index if not exists idx_categories_owner
  on public.categories (owner_id, sort_order);

alter table public.categories enable row level security;

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories
  for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.categories from anon;
grant select, insert, update, delete on public.categories to authenticated;

-- Poultry-farm defaults, seeded for every new profile (and backfilled below).
create or replace function public.seed_default_categories(p_owner uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.categories (owner_id, name, emoji, sort_order)
  values
    (p_owner, 'Feed',        '🌾', 10),
    (p_owner, 'Chicks',      '🐣', 20),
    (p_owner, 'Medicine',    '💊', 30),
    (p_owner, 'Vaccine',     '💉', 40),
    (p_owner, 'Labour',      '👷', 50),
    (p_owner, 'Electricity', '💡', 60),
    (p_owner, 'Water',       '💧', 70),
    (p_owner, 'Transport',   '🚚', 80),
    (p_owner, 'Equipment',   '🔧', 90),
    (p_owner, 'Repair',      '🛠️', 100),
    (p_owner, 'Bedding',     '🌿', 110),
    (p_owner, 'Rent',        '🏠', 120),
    (p_owner, 'Other',       '📦', 130)
  on conflict do nothing;
$$;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;
revoke execute on function public.handle_new_profile() from public, anon, authenticated;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- Backfill existing users.
select public.seed_default_categories(p.id)
from public.profiles p
where not exists (select 1 from public.categories c where c.owner_id = p.id);

-- The icon is copied onto the expense so people it is shared with (who cannot
-- see the owner's category list) still get the right picture.
alter table public.kharcha add column if not exists category_icon text;

-- ---------------------------------------------------------------------------
-- Trusted contacts
-- ---------------------------------------------------------------------------

create table if not exists public.trusted_contacts (
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  contact_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, contact_id),
  check (owner_id <> contact_id)
);
create index if not exists idx_trusted_contacts_contact on public.trusted_contacts (contact_id);

alter table public.trusted_contacts enable row level security;

drop policy if exists trusted_contacts_select on public.trusted_contacts;
create policy trusted_contacts_select on public.trusted_contacts
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists trusted_contacts_insert on public.trusted_contacts;
create policy trusted_contacts_insert on public.trusted_contacts
  for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists trusted_contacts_delete on public.trusted_contacts;
create policy trusted_contacts_delete on public.trusted_contacts
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.trusted_contacts from anon;
grant select, insert, delete on public.trusted_contacts to authenticated;

-- True when either side has added the other. SECURITY DEFINER so it can be
-- used inside the profiles policy without a policy chain.
create or replace function public.is_connected_with(p_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.trusted_contacts t
    where (t.owner_id = auth.uid() and t.contact_id = p_id)
       or (t.owner_id = p_id and t.contact_id = auth.uid())
  );
$$;
revoke execute on function public.is_connected_with(uuid) from public, anon;
grant  execute on function public.is_connected_with(uuid) to authenticated;

-- Directory lock-down: you see yourself and the people you are connected with.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or public.is_connected_with(id));

-- Exact-email lookup for "add a person" — no browsing, no partial matches.
create or replace function public.find_profile_by_email(p_email text)
returns table (id uuid, email text, display_name text, avatar_url text)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select p.id, p.email, p.display_name, p.avatar_url
  from public.profiles p
  where p.email_lower = lower(btrim(p_email))
    and p.id <> auth.uid()
  limit 1;
$$;
revoke execute on function public.find_profile_by_email(text) from public, anon;
grant  execute on function public.find_profile_by_email(text) to authenticated;

-- Sharing is now limited to the owner's trusted list.
drop policy if exists shares_insert on public.kharcha_shares;
create policy shares_insert on public.kharcha_shares
  for insert to authenticated
  with check (
    public.owns_kharcha(kharcha_id)
    and (select auth.uid()) = shared_by
    and exists (
      select 1 from public.trusted_contacts t
      where t.owner_id = (select auth.uid()) and t.contact_id = shared_with
    )
  );

-- Removing someone from the list takes back everything shared with them.
create or replace function public.handle_trusted_contact_removed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.kharcha_shares s
  using public.kharcha k
  where s.kharcha_id = k.id
    and k.owner_id = old.owner_id
    and s.shared_with = old.contact_id;

  update public.kharcha k
     set visibility = 'private'
   where k.owner_id = old.owner_id
     and k.visibility = 'shared'
     and not exists (select 1 from public.kharcha_shares s where s.kharcha_id = k.id);
  return old;
end;
$$;
revoke execute on function public.handle_trusted_contact_removed() from public, anon, authenticated;

drop trigger if exists on_trusted_contact_removed on public.trusted_contacts;
create trigger on_trusted_contact_removed
  after delete on public.trusted_contacts
  for each row execute function public.handle_trusted_contact_removed();
