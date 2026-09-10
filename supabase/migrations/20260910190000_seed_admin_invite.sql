-- Named admin invite; from here on sign-up is strictly by invitation
-- (the "first account becomes admin" bootstrap is removed).
insert into public.invites (email, role)
values ('talha@obscode.io', 'admin')
on conflict (email) do update set role = 'admin';

create or replace function public.enforce_invite_only()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(new.email, '')));
begin
  if exists (select 1 from public.invites i where i.email = v_email and i.accepted_at is null) then
    return new;
  end if;
  raise exception 'This app is invite-only. Ask your admin to add %.', v_email
    using errcode = '42501';
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(new.email, '')));
  v_role  text;
begin
  select i.role into v_role from public.invites i where i.email = v_email;

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
    coalesce(v_role, 'member')
  )
  on conflict (id) do nothing;

  update public.invites set accepted_at = now() where email = v_email and accepted_at is null;
  return new;
end;
$$;
