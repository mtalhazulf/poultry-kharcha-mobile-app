create table public.khata_entries (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  -- Positive = borrowed from the organization (owes more); negative = repaid.
  amount     numeric(12, 2) not null check (amount <> 0),
  note       text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.khata_entries enable row level security;

create policy khata_entries_select on public.khata_entries
  for select to authenticated
  using (public.is_org_member(org_id));

create policy khata_entries_insert on public.khata_entries
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_org_member(org_id));

create policy khata_entries_update on public.khata_entries
  for update to authenticated
  using (user_id = (select auth.uid()) and public.is_org_member(org_id))
  with check (user_id = (select auth.uid()) and public.is_org_member(org_id));

create policy khata_entries_delete on public.khata_entries
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_org_admin(org_id));

create trigger khata_entries_set_updated_at
  before update on public.khata_entries
  for each row execute function public.set_updated_at();
