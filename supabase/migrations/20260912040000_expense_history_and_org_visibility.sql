-- Remove the per-recipient expense sharing feature: every active organization
-- member now sees every expense in their organization (owners/admins already did).
drop policy if exists shares_select on public.kharcha_shares;
drop policy if exists shares_insert on public.kharcha_shares;
drop policy if exists shares_delete on public.kharcha_shares;
drop table if exists public.kharcha_shares;

drop policy if exists kharcha_select on public.kharcha;
drop function if exists public.is_shared_with_me(uuid);

-- Used by the receipts storage bucket policies; simplify to plain org membership
-- now that owner/admin/shared-recipient special-casing is no longer needed.
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
  );
$$;

create policy kharcha_select on public.kharcha
  for select to authenticated
  using (public.is_org_member(org_id));

-- These two RPCs no longer need to revoke expense shares on exit.
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
end;
$$;

drop function if exists public.revoke_member_shares(uuid, uuid);

alter table public.kharcha drop column if exists visibility;

-- ---------------------------------------------------------------------------
-- Expense edit history: every real edit archives the prior state as a version.
-- ---------------------------------------------------------------------------
create table public.kharcha_history (
  id            uuid primary key default gen_random_uuid(),
  kharcha_id    uuid not null references public.kharcha (id) on delete cascade,
  version       integer not null,
  amount        numeric(12, 2) not null,
  category      text not null,
  category_icon text,
  note          text,
  expense_date  date not null,
  receipt_path  text,
  edited_by     uuid not null references public.profiles (id),
  edited_at     timestamptz not null default now(),
  unique (kharcha_id, version)
);

alter table public.kharcha_history enable row level security;

create policy kharcha_history_select on public.kharcha_history
  for select to authenticated
  using (exists (
    select 1 from public.kharcha k
    where k.id = kharcha_history.kharcha_id and public.is_org_member(k.org_id)
  ));

revoke all on public.kharcha_history from anon, authenticated;
grant select on public.kharcha_history to authenticated;

create or replace function public.snapshot_kharcha_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.amount, old.category, old.category_icon, old.note, old.expense_date, old.receipt_path)
     is distinct from
     (new.amount, new.category, new.category_icon, new.note, new.expense_date, new.receipt_path)
  then
    insert into public.kharcha_history
      (kharcha_id, version, amount, category, category_icon, note, expense_date, receipt_path, edited_by)
    values (
      old.id,
      coalesce((select max(version) from public.kharcha_history where kharcha_id = old.id), 0) + 1,
      old.amount, old.category, old.category_icon, old.note, old.expense_date, old.receipt_path,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists kharcha_snapshot_history on public.kharcha;
create trigger kharcha_snapshot_history
  before update on public.kharcha
  for each row execute function public.snapshot_kharcha_history();
