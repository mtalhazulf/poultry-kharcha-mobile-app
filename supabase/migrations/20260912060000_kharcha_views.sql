create table public.kharcha_views (
  id         uuid primary key default gen_random_uuid(),
  kharcha_id uuid not null references public.kharcha (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  read_at    timestamptz,
  unique (kharcha_id, user_id)
);

alter table public.kharcha_views enable row level security;

-- Everyone can read their own row (so the button can show "already read");
-- only the expense's owner or an org admin can see everyone else's.
create policy kharcha_views_select on public.kharcha_views
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.kharcha k
      where k.id = kharcha_views.kharcha_id
        and (k.owner_id = (select auth.uid()) or public.is_org_admin(k.org_id))
    )
  );

-- Anyone who can see the expense can mark themselves viewed/read.
create policy kharcha_views_upsert on public.kharcha_views
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_access_kharcha(kharcha_id));

create policy kharcha_views_update on public.kharcha_views
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.kharcha_views from anon;
grant select, insert, update on public.kharcha_views to authenticated;
