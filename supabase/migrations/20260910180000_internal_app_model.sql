-- ============================================================================
-- Internal-app model: invite-only sign-up, admin/member roles, org-wide
-- expense categories. Supersedes 20260910170000 (per-user contact lists):
-- for a closed staff app the directory *is* the trusted list, so the contact
-- layer is removed and sign-up is gated instead.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Undo the per-user contact model
-- ---------------------------------------------------------------------------
drop policy   if exists shares_insert   on public.kharcha_shares; -- referenced trusted_contacts
drop policy   if exists profiles_select on public.profiles;       -- referenced is_connected_with
drop trigger  if exists on_trusted_contact_removed on public.trusted_contacts;
drop function if exists public.handle_trusted_contact_removed();
drop table    if exists public.trusted_contacts;
drop function if exists public.is_connected_with(uuid);
drop function if exists public.find_profile_by_email(text);
drop trigger  if exists on_profile_created on public.profiles;
drop function if exists public.handle_new_profile();
drop function if exists public.seed_default_categories(uuid);
drop table    if exists public.categories;

-- ---------------------------------------------------------------------------
-- Roles + account status
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'member'
    check (role in ('admin', 'member')),
  add column if not exists disabled boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and not disabled
  );
$$;

-- A disabled account keeps its login but can no longer read or write data.
create or replace function public.is_active_member()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and not disabled
  );
$$;

revoke execute on function public.is_admin()         from public, anon;
revoke execute on function public.is_active_member() from public, anon;
grant  execute on function public.is_admin()         to authenticated;
grant  execute on function public.is_active_member() to authenticated;

-- Members may edit their own name/avatar but never their role or status.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.role is distinct from old.role or new.disabled is distinct from old.disabled)
     and not public.is_admin() then
    raise exception 'Only an admin can change roles or account status'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_profile_privileges() from public, anon, authenticated;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- Staff directory: every active member can see every profile (it only
-- contains invited staff). Admins may update anyone (role / disabled).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (public.is_active_member() or (select auth.uid()) = id);

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Invites — the only way into the app
-- ---------------------------------------------------------------------------
create table if not exists public.invites (
  email       text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  role        text not null default 'member' check (role in ('admin', 'member')),
  invited_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.invites enable row level security;

drop policy if exists invites_admin_all on public.invites;
create policy invites_admin_all on public.invites
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.invites from anon;
grant select, insert, update, delete on public.invites to authenticated;

-- Reject any sign-up (password or OAuth) that is not invited. The very first
-- account is allowed through and becomes admin so the app can be bootstrapped;
-- do that immediately after deploying, or pre-insert an admin invite via SQL.
create or replace function public.enforce_invite_only()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(new.email, '')));
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    return new; -- bootstrap: first account
  end if;
  if exists (select 1 from public.invites i where i.email = v_email and i.accepted_at is null) then
    return new;
  end if;
  raise exception 'This app is invite-only. Ask your admin to add %.', v_email
    using errcode = '42501';
end;
$$;
revoke execute on function public.enforce_invite_only() from public, anon, authenticated;

drop trigger if exists on_auth_user_invite_check on auth.users;
create trigger on_auth_user_invite_check
  before insert on auth.users
  for each row execute function public.enforce_invite_only();

-- Profile creation now assigns the role from the invite (admin for bootstrap).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(new.email, '')));
  v_role  text := 'member';
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    v_role := 'admin';
  else
    select i.role into v_role from public.invites i where i.email = v_email;
    v_role := coalesce(v_role, 'member');
  end if;

  insert into public.profiles (id, email, display_name, avatar_url, role)
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
    ), ''),
    v_role
  )
  on conflict (id) do nothing;

  update public.invites set accepted_at = now() where email = v_email and accepted_at is null;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Org-wide expense categories (admin-managed, poultry defaults)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 40),
  emoji      text not null default '📦' check (length(emoji) between 1 and 8),
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists categories_name_key on public.categories (lower(btrim(name)));

alter table public.categories enable row level security;

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to authenticated using (public.is_active_member());
drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.categories from anon;
grant select, insert, update, delete on public.categories to authenticated;

insert into public.categories (name, emoji, sort_order)
select * from (values
  ('Feed',        '🌾', 10),
  ('Chicks',      '🐣', 20),
  ('Medicine',    '💊', 30),
  ('Vaccine',     '💉', 40),
  ('Labour',      '👷', 50),
  ('Electricity', '💡', 60),
  ('Water',       '💧', 70),
  ('Transport',   '🚚', 80),
  ('Equipment',   '🔧', 90),
  ('Repair',      '🛠️', 100),
  ('Bedding',     '🌿', 110),
  ('Rent',        '🏠', 120),
  ('Other',       '📦', 130)
) as v(name, emoji, sort_order)
where not exists (select 1 from public.categories);

-- kharcha.category_icon (added in the previous migration) stays: the icon is
-- frozen on the row so renaming a category later does not rewrite history.

-- ---------------------------------------------------------------------------
-- Data policies now also require an active (non-disabled) account.
-- Sharing goes back to "any colleague" — the directory is staff only.
-- ---------------------------------------------------------------------------
drop policy if exists kharcha_select on public.kharcha;
create policy kharcha_select on public.kharcha
  for select to authenticated
  using (
    public.is_active_member()
    and ((select auth.uid()) = owner_id or public.is_shared_with_me(id))
  );

drop policy if exists kharcha_insert on public.kharcha;
create policy kharcha_insert on public.kharcha
  for insert to authenticated
  with check (public.is_active_member() and (select auth.uid()) = owner_id);

drop policy if exists kharcha_update on public.kharcha;
create policy kharcha_update on public.kharcha
  for update to authenticated
  using (public.is_active_member() and (select auth.uid()) = owner_id)
  with check (public.is_active_member() and (select auth.uid()) = owner_id);

drop policy if exists kharcha_delete on public.kharcha;
create policy kharcha_delete on public.kharcha
  for delete to authenticated
  using (public.is_active_member() and (select auth.uid()) = owner_id);

drop policy if exists shares_select on public.kharcha_shares;
create policy shares_select on public.kharcha_shares
  for select to authenticated
  using (
    public.is_active_member()
    and ((select auth.uid()) = shared_with or public.owns_kharcha(kharcha_id))
  );

drop policy if exists shares_insert on public.kharcha_shares;
create policy shares_insert on public.kharcha_shares
  for insert to authenticated
  with check (
    public.is_active_member()
    and public.owns_kharcha(kharcha_id)
    and (select auth.uid()) = shared_by
  );

drop policy if exists shares_delete on public.kharcha_shares;
create policy shares_delete on public.kharcha_shares
  for delete to authenticated
  using (public.is_active_member() and public.owns_kharcha(kharcha_id));
