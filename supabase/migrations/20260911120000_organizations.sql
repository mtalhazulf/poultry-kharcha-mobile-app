-- ============================================================================
-- Organizations — multi-tenant model (build contract: docs/ARCHITECTURE.md §2)
-- ============================================================================
-- Replaces the single-tenant internal app (invite-only sign-up, a global
-- admin/member role on profiles, one global category list) with
-- organizations:
--   * anyone can sign up; joining an organization takes an invite code and
--     approval by an owner/admin;
--   * role (owner/admin/member) and status (active/pending/disabled) live on
--     the membership, per organization;
--   * every expense and expense type belongs to exactly one organization.
--
-- Existing data moves into one organization named "MPS". That step is
-- guarded, so this file also applies cleanly to an empty database.
--
-- Order matters: Postgres records policy -> function dependencies, so
-- policies are dropped first, then triggers, then functions, then columns
-- and tables. Every function pins `search_path = ''` and schema-qualifies
-- every name it touches.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Drop policies that reference functions/columns replaced below
-- ---------------------------------------------------------------------------
drop policy if exists categories_select      on public.categories;
drop policy if exists categories_admin_write on public.categories;
drop policy if exists categories_insert      on public.categories;
drop policy if exists categories_update      on public.categories;
drop policy if exists categories_delete      on public.categories;
drop policy if exists invites_admin_all      on public.invites;
drop policy if exists kharcha_select         on public.kharcha;
drop policy if exists kharcha_insert         on public.kharcha;
drop policy if exists kharcha_update         on public.kharcha;
drop policy if exists kharcha_delete         on public.kharcha;
drop policy if exists shares_select          on public.kharcha_shares;
drop policy if exists shares_insert          on public.kharcha_shares;
drop policy if exists shares_delete          on public.kharcha_shares;
drop policy if exists profiles_select        on public.profiles;
drop policy if exists profiles_insert_own    on public.profiles;
drop policy if exists profiles_update_own    on public.profiles;
drop policy if exists profiles_update_admin  on public.profiles;
drop policy if exists receipts_select        on storage.objects;
drop policy if exists receipts_insert        on storage.objects;
drop policy if exists receipts_update        on storage.objects;
drop policy if exists receipts_delete        on storage.objects;

-- ---------------------------------------------------------------------------
-- 2. Drop triggers of the invite-only / global-role model
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_invite_check on auth.users;
drop trigger if exists profiles_guard_privileges on public.profiles;

-- ---------------------------------------------------------------------------
-- 3. Drop functions (the kharcha helpers are recreated with org-aware bodies
--    and renamed parameters, which `create or replace` cannot do)
-- ---------------------------------------------------------------------------
drop function if exists public.enforce_invite_only();
drop function if exists public.guard_profile_privileges();
drop function if exists public.is_admin();
drop function if exists public.is_active_member();
drop function if exists public.can_access_kharcha(uuid);
drop function if exists public.owns_kharcha(uuid);
drop function if exists public.is_shared_with_me(uuid);

-- ---------------------------------------------------------------------------
-- 4. Existing functions: empty search_path; sign-up only creates the profile
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

alter function public.safe_uuid(text) set search_path = '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(btrim(coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )), ''),
    nullif(coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. New tables
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 2 and 80),
  currency   text not null default 'PKR' check (currency ~ '^[A-Z]{3}$'),
  created_by uuid constraint organizations_created_by_fkey
               references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_organizations_created_by on public.organizations (created_by);

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- Admins only (RLS). Alphabet ABCDEFGHJKLMNPQRSTUVWXYZ23456789: no I/O/0/1.
create table if not exists public.organization_invite_codes (
  org_id     uuid primary key constraint organization_invite_codes_org_id_fkey
               references public.organizations (id) on delete cascade,
  code       text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  updated_by uuid constraint organization_invite_codes_updated_by_fkey
               references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists idx_org_invite_codes_updated_by
  on public.organization_invite_codes (updated_by);

create table if not exists public.organization_members (
  org_id       uuid not null constraint organization_members_org_id_fkey
                 references public.organizations (id) on delete cascade,
  user_id      uuid not null constraint organization_members_user_id_fkey
                 references public.profiles (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status       text not null default 'pending' check (status in ('active', 'pending', 'disabled')),
  requested_at timestamptz not null default now(),
  approved_at  timestamptz,
  approved_by  uuid constraint organization_members_approved_by_fkey
                 references public.profiles (id) on delete set null,
  primary key (org_id, user_id)
);
create index if not exists idx_org_members_user on public.organization_members (user_id);
create index if not exists idx_org_members_approved_by on public.organization_members (approved_by);
create unique index if not exists org_members_one_owner
  on public.organization_members (org_id) where role = 'owner';

alter table public.organizations             enable row level security;
alter table public.organization_invite_codes enable row level security;
alter table public.organization_members      enable row level security;

-- Writes go through the RPCs below (SECURITY DEFINER); clients only read.
revoke all on public.organizations             from anon, authenticated;
revoke all on public.organization_invite_codes from anon, authenticated;
revoke all on public.organization_members      from anon, authenticated;
grant select on public.organizations             to authenticated;
grant select on public.organization_invite_codes to authenticated;
grant select on public.organization_members      to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Changed tables, part 1: new columns (nullable until the data is moved)
-- ---------------------------------------------------------------------------
alter table public.categories
  add column if not exists org_id uuid constraint categories_org_id_fkey
    references public.organizations (id) on delete cascade,
  add column if not exists icon text not null default 'package';

alter table public.kharcha
  add column if not exists org_id uuid constraint kharcha_org_id_fkey
    references public.organizations (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 7. Helper functions (used by RLS policies; answer only about the caller)
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.has_org_membership(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

-- Both active in one organization, or the caller administers an organization
-- where p_user has any membership (so admins can see who is asking to join).
create or replace function public.shares_org_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members me
    join public.organization_members them on them.org_id = me.org_id
    where me.user_id = auth.uid()
      and them.user_id = p_user
      and me.status = 'active'
      and (them.status = 'active' or me.role in ('owner', 'admin'))
  );
$$;

create or replace function public.is_shared_with_me(p_kharcha uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.kharcha_shares s
    where s.kharcha_id = p_kharcha and s.shared_with = auth.uid()
  );
$$;

-- Caller owns the expense and is an active member of its organization.
create or replace function public.owns_kharcha(p_kharcha uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kharcha k
    join public.organization_members m
      on m.org_id = k.org_id and m.user_id = k.owner_id
    where k.id = p_kharcha
      and k.owner_id = auth.uid()
      and m.status = 'active'
  );
$$;

-- Caller is an active member of the expense's organization and is its owner,
-- an admin of that organization, or a share recipient.
create or replace function public.can_access_kharcha(p_kharcha uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kharcha k
    join public.organization_members m
      on m.org_id = k.org_id and m.user_id = auth.uid() and m.status = 'active'
    where k.id = p_kharcha
      and (
        k.owner_id = auth.uid()
        or m.role in ('owner', 'admin')
        or exists (
          select 1 from public.kharcha_shares s
          where s.kharcha_id = k.id and s.shared_with = auth.uid()
        )
      )
  );
$$;

-- 8 characters, 5 bits each from pgcrypto (256 % 32 = 0, so no modulo bias).
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code  text;
begin
  loop
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (
      select 1 from public.organization_invite_codes c where c.code = v_code
    );
  end loop;
  return v_code;
end;
$$;

-- Internal: sets (or replaces) an organization's invite code, retrying when a
-- concurrent writer claimed the same code first.
create or replace function public.assign_invite_code(p_org uuid, p_actor uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code    text;
  v_attempt integer := 0;
begin
  loop
    v_attempt := v_attempt + 1;
    v_code := public.generate_invite_code();
    begin
      insert into public.organization_invite_codes (org_id, code, updated_by, updated_at)
      values (p_org, v_code, p_actor, now())
      on conflict (org_id) do update
        set code = excluded.code,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at;
      return v_code;
    exception
      when unique_violation then
        if v_attempt >= 10 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

-- Internal: a person who leaves or is removed loses what was shared with them
-- in that organization; expenses left with no recipients become private.
create or replace function public.revoke_member_shares(p_org uuid, p_user uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  with removed as (
    delete from public.kharcha_shares s
    using public.kharcha k
    where s.kharcha_id = k.id
      and k.org_id = p_org
      and s.shared_with = p_user
    returning s.kharcha_id
  )
  update public.kharcha k
     set visibility = 'private'
   where k.id in (select r.kharcha_id from removed r)
     and k.visibility = 'shared'
     and not exists (
       select 1 from public.kharcha_shares s2
       where s2.kharcha_id = k.id and s2.shared_with <> p_user
     );
$$;

-- An expense never moves between organizations.
create or replace function public.prevent_kharcha_org_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.org_id is distinct from old.org_id then
    raise exception 'An expense cannot be moved to another organization'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(p_name text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_org  public.organizations;
begin
  if v_uid is null then
    raise exception 'You need to be signed in' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'Organization name must be 2 to 80 characters' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  insert into public.organizations (name, created_by)
  values (v_name, v_uid)
  returning * into v_org;

  insert into public.organization_members (org_id, user_id, role, status, approved_at, approved_by)
  values (v_org.id, v_uid, 'owner', 'active', now(), v_uid);

  perform public.assign_invite_code(v_org.id, v_uid);

  insert into public.categories (org_id, name, icon, sort_order)
  select v_org.id, d.name, d.icon, d.sort_order
  from (values
    ('Feed',        'wheat',     10),
    ('Chicks',      'egg',       20),
    ('Medicine',    'pill',      30),
    ('Vaccine',     'syringe',   40),
    ('Labour',      'hard-hat',  50),
    ('Electricity', 'zap',       60),
    ('Water',       'droplets',  70),
    ('Transport',   'truck',     80),
    ('Equipment',   'wrench',    90),
    ('Repair',      'hammer',   100),
    ('Bedding',     'layers',   110),
    ('Rent',        'warehouse', 120),
    ('Other',       'package',  130)
  ) as d(name, icon, sort_order);

  return v_org;
end;
$$;

create or replace function public.request_to_join(p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_code     text := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  v_org_id   uuid;
  v_org_name text;
  v_status   text;
begin
  if v_uid is null then
    raise exception 'You need to be signed in' using errcode = '42501';
  end if;

  select c.org_id, o.name
    into v_org_id, v_org_name
    from public.organization_invite_codes c
    join public.organizations o on o.id = c.org_id
   where c.code = v_code;

  if v_org_id is null then
    raise exception 'Invite code not found' using errcode = 'P0002';
  end if;

  insert into public.organization_members (org_id, user_id, role, status)
  values (v_org_id, v_uid, 'member', 'pending')
  on conflict (org_id, user_id) do nothing;

  select m.status into v_status
    from public.organization_members m
   where m.org_id = v_org_id and m.user_id = v_uid;

  if v_status = 'disabled' then
    raise exception 'Your access to % has been turned off. Ask an admin to restore it.', v_org_name
      using errcode = '42501';
  end if;

  return json_build_object('org_id', v_org_id, 'org_name', v_org_name, 'status', v_status);
end;
$$;

create or replace function public.approve_join_request(p_org uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_org_admin(p_org) then
    raise exception 'Only an admin can approve join requests' using errcode = '42501';
  end if;

  update public.organization_members m
     set status = 'active', approved_at = now(), approved_by = auth.uid()
   where m.org_id = p_org and m.user_id = p_user and m.status = 'pending';

  if not found then
    raise exception 'Join request not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.decline_join_request(p_org uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_org_admin(p_org) then
    raise exception 'Only an admin can decline join requests' using errcode = '42501';
  end if;

  delete from public.organization_members m
   where m.org_id = p_org and m.user_id = p_user and m.status = 'pending';

  if not found then
    raise exception 'Join request not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.set_member_role(p_org uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if not public.is_org_admin(p_org) then
    raise exception 'Only an admin can change roles' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('admin', 'member') then
    raise exception 'Role must be admin or member' using errcode = '23514';
  end if;
  if p_user = auth.uid() then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;

  select m.role into v_role
    from public.organization_members m
   where m.org_id = p_org and m.user_id = p_user
     for update;

  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if v_role = 'owner' then
    raise exception 'The owner''s role cannot be changed. Transfer ownership instead.'
      using errcode = '42501';
  end if;

  update public.organization_members m
     set role = p_role
   where m.org_id = p_org and m.user_id = p_user;
end;
$$;

create or replace function public.set_member_status(p_org uuid, p_user uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role   text;
  v_status text;
begin
  if not public.is_org_admin(p_org) then
    raise exception 'Only an admin can change member access' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('active', 'disabled') then
    raise exception 'Status must be active or disabled' using errcode = '23514';
  end if;
  if p_user = auth.uid() then
    raise exception 'You cannot change your own access' using errcode = '42501';
  end if;

  select m.role, m.status into v_role, v_status
    from public.organization_members m
   where m.org_id = p_org and m.user_id = p_user
     for update;

  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if v_role = 'owner' then
    raise exception 'The owner''s access cannot be changed' using errcode = '42501';
  end if;
  if v_status = 'pending' then
    raise exception 'Approve or decline the join request first' using errcode = '23514';
  end if;

  update public.organization_members m
     set status = p_status
   where m.org_id = p_org and m.user_id = p_user;
end;
$$;

create or replace function public.remove_member(p_org uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if not public.is_org_admin(p_org) then
    raise exception 'Only an admin can remove members' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'You cannot remove yourself. Leave the organization instead.'
      using errcode = '42501';
  end if;

  select m.role into v_role
    from public.organization_members m
   where m.org_id = p_org and m.user_id = p_user
     for update;

  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if v_role = 'owner' then
    raise exception 'The owner cannot be removed' using errcode = '42501';
  end if;

  delete from public.organization_members m
   where m.org_id = p_org and m.user_id = p_user;

  perform public.revoke_member_shares(p_org, p_user);
end;
$$;

create or replace function public.leave_organization(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then
    raise exception 'You need to be signed in' using errcode = '42501';
  end if;

  select m.role into v_role
    from public.organization_members m
   where m.org_id = p_org and m.user_id = v_uid
     for update;

  if not found then
    raise exception 'You are not a member of this organization' using errcode = 'P0002';
  end if;
  if v_role = 'owner' then
    raise exception 'Transfer ownership to another member before leaving' using errcode = '42501';
  end if;

  delete from public.organization_members m
   where m.org_id = p_org and m.user_id = v_uid;

  perform public.revoke_member_shares(p_org, v_uid);
end;
$$;

create or replace function public.transfer_ownership(p_org uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_status text;
begin
  if not exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = v_uid and m.role = 'owner' and m.status = 'active'
  ) then
    raise exception 'Only the owner can transfer ownership' using errcode = '42501';
  end if;
  if p_user = v_uid then
    raise exception 'You already own this organization' using errcode = '23514';
  end if;

  select m.status into v_status
    from public.organization_members m
   where m.org_id = p_org and m.user_id = p_user
     for update;

  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if v_status <> 'active' then
    raise exception 'Ownership can only go to an active member' using errcode = '23514';
  end if;

  -- Demote first: at most one owner per organization (partial unique index).
  update public.organization_members m
     set role = 'admin'
   where m.org_id = p_org and m.user_id = v_uid;

  update public.organization_members m
     set role = 'owner'
   where m.org_id = p_org and m.user_id = p_user;
end;
$$;

create or replace function public.rename_organization(p_org uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not public.is_org_admin(p_org) then
    raise exception 'Only an admin can rename the organization' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'Organization name must be 2 to 80 characters' using errcode = '23514';
  end if;

  update public.organizations o set name = v_name where o.id = p_org;

  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.regenerate_invite_code(p_org uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_org_admin(p_org) then
    raise exception 'Only an admin can change the invite code' using errcode = '42501';
  end if;
  return public.assign_invite_code(p_org, auth.uid());
end;
$$;

-- SECURITY INVOKER: RLS on kharcha decides what is counted, so owners/admins
-- get the whole organization and members get their own + shared expenses.
-- byDay lists only days that have expenses (ascending); fill gaps client-side.
create or replace function public.report_summary(p_org uuid, p_from date, p_to date)
returns json
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_days      integer;
  v_prev_from date;
  v_prev_to   date;
  v_result    json;
begin
  if p_org is null or p_from is null or p_to is null then
    raise exception 'Organization and date range are required' using errcode = '23514';
  end if;
  if p_to < p_from then
    raise exception 'The end date must be on or after the start date' using errcode = '23514';
  end if;
  if not public.is_org_member(p_org) then
    raise exception 'You are not an active member of this organization' using errcode = '42501';
  end if;

  v_days := p_to - p_from + 1;
  v_prev_to := p_from - 1;
  v_prev_from := p_from - v_days;

  with scoped as (
    select k.owner_id, k.amount, k.category, k.category_icon, k.expense_date, k.created_at
    from public.kharcha k
    where k.org_id = p_org
      and k.expense_date between p_from and p_to
  ),
  by_category as (
    select s.category,
           coalesce(
             (select c.icon from public.categories c
               where c.org_id = p_org and lower(c.name) = lower(s.category)
               limit 1),
             (array_agg(s.category_icon order by s.created_at desc)
                filter (where s.category_icon is not null))[1]
           ) as icon,
           sum(s.amount) as total,
           count(*) as cnt
    from scoped s
    group by s.category
  ),
  by_member as (
    select s.owner_id, sum(s.amount) as total, count(*) as cnt
    from scoped s
    group by s.owner_id
  ),
  by_day as (
    select s.expense_date as day, sum(s.amount) as total
    from scoped s
    group by s.expense_date
  )
  select json_build_object(
    'total', coalesce((select sum(s.amount) from scoped s), 0),
    'count', (select count(*) from scoped),
    'previousTotal', coalesce((
      select sum(k.amount) from public.kharcha k
      where k.org_id = p_org and k.expense_date between v_prev_from and v_prev_to
    ), 0),
    'byCategory', coalesce((
      select json_agg(
               json_build_object('category', b.category, 'icon', b.icon,
                                 'total', b.total, 'count', b.cnt)
               order by b.total desc, b.category)
      from by_category b
    ), '[]'::json),
    'byMember', coalesce((
      select json_agg(
               json_build_object(
                 'userId', m.owner_id,
                 'name', coalesce(nullif(btrim(p.display_name), ''), nullif(p.email, ''), 'Former member'),
                 'email', coalesce(p.email, ''),
                 'total', m.total,
                 'count', m.cnt)
               order by m.total desc, m.owner_id)
      from by_member m
      left join public.profiles p on p.id = m.owner_id
    ), '[]'::json),
    'byDay', coalesce((
      select json_agg(json_build_object('date', d.day, 'total', d.total) order by d.day)
      from by_day d
    ), '[]'::json)
  )
  into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Data: existing people, expense types and expenses move into org "MPS"
-- ---------------------------------------------------------------------------
-- Keep updated_at as it was on migrated expenses.
alter table public.kharcha disable trigger kharcha_set_updated_at;

do $$
declare
  -- Old emoji -> lucide icon key. Name wins over emoji; unknown -> package.
  v_icon_by_name constant jsonb := '{
    "feed": "wheat", "chicks": "egg", "medicine": "pill", "vaccine": "syringe",
    "labour": "hard-hat", "labor": "hard-hat", "electricity": "zap", "water": "droplets",
    "transport": "truck", "equipment": "wrench", "repair": "hammer", "bedding": "layers",
    "rent": "warehouse", "other": "package"
  }';
  -- Keys are stored without U+FE0F (variation selector); lookups strip it too.
  v_icon_by_emoji constant jsonb := '{
    "🌾": "wheat", "🐣": "egg", "🐥": "egg", "🥚": "egg", "🐔": "bird", "🐓": "bird",
    "💊": "pill", "💉": "syringe", "👷": "hard-hat", "💡": "zap", "⚡": "zap",
    "💧": "droplets", "🚰": "droplets", "🔥": "flame", "⛽": "fuel",
    "🚚": "truck", "🚛": "truck", "🔧": "wrench", "🛠": "hammer", "🔨": "hammer",
    "🌿": "layers", "🏠": "warehouse", "🏡": "house", "🧹": "spray-can", "🧴": "spray-can",
    "🛒": "shopping-cart", "🧾": "receipt", "💵": "banknote", "💰": "banknote",
    "📱": "phone", "📶": "wifi", "👥": "users", "📦": "package"
  }';
  v_creator uuid;
  v_org     uuid;
begin
  if not exists (select 1 from public.profiles) then
    -- Empty database: the old migration seeded ownerless global categories.
    delete from public.categories where org_id is null;
    return;
  end if;

  select p.id into v_creator
    from public.profiles p
   where p.email_lower = 'talha@obscode.io'
   order by p.created_at
   limit 1;
  if v_creator is null then
    select p.id into v_creator
      from public.profiles p
     where p.role = 'admin'
     order by p.created_at, p.id
     limit 1;
  end if;
  if v_creator is null then
    select p.id into v_creator
      from public.profiles p
     order by p.created_at, p.id
     limit 1;
  end if;

  insert into public.organizations (name, created_by)
  values ('MPS', v_creator)
  returning id into v_org;

  insert into public.organization_members (org_id, user_id, role, status, requested_at, approved_at)
  select v_org,
         p.id,
         case when p.id = v_creator then 'owner'
              when p.role = 'admin' then 'admin'
              else 'member' end,
         -- The owner always stays active so the organization is never locked.
         case when p.id <> v_creator and p.disabled then 'disabled' else 'active' end,
         p.created_at,
         now()
    from public.profiles p;

  perform public.assign_invite_code(v_org, v_creator);

  update public.categories c
     set org_id = v_org,
         icon = coalesce(
           v_icon_by_name ->> lower(btrim(c.name)),
           v_icon_by_emoji ->> replace(btrim(c.emoji), chr(65039), ''),
           'package')
   where c.org_id is null;

  update public.kharcha k
     set org_id = v_org,
         category_icon = coalesce(
           v_icon_by_name ->> lower(btrim(k.category)),
           v_icon_by_emoji ->> replace(btrim(coalesce(k.category_icon, '')), chr(65039), ''),
           'package')
   where k.org_id is null;
end
$$;

alter table public.kharcha enable trigger kharcha_set_updated_at;

-- ---------------------------------------------------------------------------
-- 10. Changed tables, part 2: constraints, indexes, dropped columns/tables
-- ---------------------------------------------------------------------------
alter table public.categories alter column org_id set not null;
alter table public.categories drop column if exists emoji;
alter table public.categories
  add constraint categories_icon_check
  check (char_length(icon) <= 40 and icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
drop index if exists public.categories_name_key;
create unique index if not exists categories_org_name_key
  on public.categories (org_id, lower(name));
create index if not exists idx_categories_org_sort
  on public.categories (org_id, sort_order);

alter table public.kharcha alter column org_id set not null;
alter table public.kharcha
  add constraint kharcha_category_icon_check
  check (category_icon is null
         or (char_length(category_icon) <= 40 and category_icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$'));
create index if not exists idx_kharcha_org_date
  on public.kharcha (org_id, expense_date desc);

drop trigger if exists kharcha_org_immutable on public.kharcha;
create trigger kharcha_org_immutable
  before update of org_id on public.kharcha
  for each row execute function public.prevent_kharcha_org_change();

alter table public.profiles drop column if exists role;
alter table public.profiles drop column if exists disabled;

drop table if exists public.invites;

-- Profiles: a person edits only their name and avatar (email follows auth).
revoke insert, update on public.profiles from authenticated;
grant insert (id, email, display_name, avatar_url) on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Row Level Security
-- ---------------------------------------------------------------------------
-- organizations: any membership (pending users see the name they asked to join)
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.has_org_membership(id));

-- invite codes: admins only
create policy org_invite_codes_select on public.organization_invite_codes
  for select to authenticated
  using (public.is_org_admin(org_id));

-- memberships: own row, everything for admins, active rows for active members
create policy org_members_select on public.organization_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_org_admin(org_id)
    or (status = 'active' and public.is_org_member(org_id))
  );

-- profiles
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_org_with(id));

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- categories: members read, admins write
create policy categories_select on public.categories
  for select to authenticated
  using (public.is_org_member(org_id));

create policy categories_insert on public.categories
  for insert to authenticated
  with check (public.is_org_admin(org_id));

create policy categories_update on public.categories
  for update to authenticated
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

create policy categories_delete on public.categories
  for delete to authenticated
  using (public.is_org_admin(org_id));

-- kharcha: owners/admins see the whole organization, members own + shared
create policy kharcha_select on public.kharcha
  for select to authenticated
  using (
    public.is_org_member(org_id)
    and (
      owner_id = (select auth.uid())
      or public.is_org_admin(org_id)
      or public.is_shared_with_me(id)
    )
  );

create policy kharcha_insert on public.kharcha
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_org_member(org_id));

create policy kharcha_update on public.kharcha
  for update to authenticated
  using (owner_id = (select auth.uid()) and public.is_org_member(org_id))
  with check (owner_id = (select auth.uid()) and public.is_org_member(org_id));

create policy kharcha_delete on public.kharcha
  for delete to authenticated
  using (
    public.is_org_member(org_id)
    and (owner_id = (select auth.uid()) or public.is_org_admin(org_id))
  );

-- kharcha_shares: recipient (with access) or active owner; owner shares only
-- with active members of the same organization
create policy shares_select on public.kharcha_shares
  for select to authenticated
  using (
    (shared_with = (select auth.uid()) and public.can_access_kharcha(kharcha_id))
    or public.owns_kharcha(kharcha_id)
  );

create policy shares_insert on public.kharcha_shares
  for insert to authenticated
  with check (
    shared_by = (select auth.uid())
    and shared_with <> (select auth.uid())
    and public.owns_kharcha(kharcha_id)
    and exists (
      select 1
      from public.kharcha k
      join public.organization_members m on m.org_id = k.org_id
      where k.id = kharcha_shares.kharcha_id
        and m.user_id = kharcha_shares.shared_with
        and m.status = 'active'
    )
  );

create policy shares_delete on public.kharcha_shares
  for delete to authenticated
  using (public.owns_kharcha(kharcha_id));

-- storage: receipts/{kharcha_id}/{file}
create policy receipts_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and public.can_access_kharcha(public.safe_uuid((storage.foldername(name))[1]))
  );

create policy receipts_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and public.owns_kharcha(public.safe_uuid((storage.foldername(name))[1]))
  );

create policy receipts_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipts'
    and public.owns_kharcha(public.safe_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'receipts'
    and public.owns_kharcha(public.safe_uuid((storage.foldername(name))[1]))
  );

create policy receipts_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and public.owns_kharcha(public.safe_uuid((storage.foldername(name))[1]))
  );

-- ---------------------------------------------------------------------------
-- 12. Function privileges
-- ---------------------------------------------------------------------------
-- Policy helpers run as the querying user, so `authenticated` needs EXECUTE.
revoke execute on function
  public.is_org_member(uuid),
  public.is_org_admin(uuid),
  public.has_org_membership(uuid),
  public.shares_org_with(uuid),
  public.is_shared_with_me(uuid),
  public.owns_kharcha(uuid),
  public.can_access_kharcha(uuid),
  public.safe_uuid(text)
from public, anon;
grant execute on function
  public.is_org_member(uuid),
  public.is_org_admin(uuid),
  public.has_org_membership(uuid),
  public.shares_org_with(uuid),
  public.is_shared_with_me(uuid),
  public.owns_kharcha(uuid),
  public.can_access_kharcha(uuid),
  public.safe_uuid(text)
to authenticated;

-- Internal helpers and trigger functions: never callable through the API.
revoke execute on function
  public.generate_invite_code(),
  public.assign_invite_code(uuid, uuid),
  public.revoke_member_shares(uuid, uuid),
  public.prevent_kharcha_org_change(),
  public.handle_new_user(),
  public.handle_user_email_change(),
  public.set_updated_at()
from public, anon, authenticated;

-- RPCs
revoke execute on function
  public.create_organization(text),
  public.request_to_join(text),
  public.approve_join_request(uuid, uuid),
  public.decline_join_request(uuid, uuid),
  public.set_member_role(uuid, uuid, text),
  public.set_member_status(uuid, uuid, text),
  public.remove_member(uuid, uuid),
  public.leave_organization(uuid),
  public.transfer_ownership(uuid, uuid),
  public.rename_organization(uuid, text),
  public.regenerate_invite_code(uuid),
  public.report_summary(uuid, date, date)
from public, anon;
grant execute on function
  public.create_organization(text),
  public.request_to_join(text),
  public.approve_join_request(uuid, uuid),
  public.decline_join_request(uuid, uuid),
  public.set_member_role(uuid, uuid, text),
  public.set_member_status(uuid, uuid, text),
  public.remove_member(uuid, uuid),
  public.leave_organization(uuid),
  public.transfer_ownership(uuid, uuid),
  public.rename_organization(uuid, text),
  public.regenerate_invite_code(uuid),
  public.report_summary(uuid, date, date)
to authenticated;

-- ---------------------------------------------------------------------------
-- 13. Realtime: kharcha + kharcha_shares stay published (clients filter
--     org_id=eq.<org>); replica identity stays DEFAULT (see 20260910150000).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kharcha'
    ) then
      alter publication supabase_realtime add table public.kharcha;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kharcha_shares'
    ) then
      alter publication supabase_realtime add table public.kharcha_shares;
    end if;
  end if;
end
$$;
