create table public.wallet_entries (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  -- Positive = a top-up; negative = an expense drew the wallet down.
  amount     numeric(12, 2) not null check (amount <> 0),
  note       text,
  -- Set only for the entry a kharcha row auto-creates; null for top-ups.
  kharcha_id uuid unique references public.kharcha (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.wallet_entries enable row level security;

-- Self, or an org admin (who can see every member's wallet to manage top-ups).
create policy wallet_entries_select on public.wallet_entries
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_org_admin(org_id));

-- Only a top-up (no kharcha_id, positive) by an admin; expense-linked entries
-- come only from the trigger below (security definer, bypasses this policy).
create policy wallet_entries_topup_insert on public.wallet_entries
  for insert to authenticated
  with check (
    kharcha_id is null
    and amount > 0
    and created_by = (select auth.uid())
    and public.is_org_admin(org_id)
  );

revoke all on public.wallet_entries from anon;
grant select, insert on public.wallet_entries to authenticated;
-- No update/delete policy for any client role: the ledger is immutable
-- except through the trigger and admin top-ups, by design ("just for display").

create or replace function public.sync_wallet_entry_for_kharcha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.wallet_entries (org_id, user_id, amount, note, kharcha_id, created_by, entry_date)
    values (new.org_id, new.owner_id, -new.amount, new.category, new.id, new.owner_id, new.expense_date);
  elsif tg_op = 'UPDATE' then
    update public.wallet_entries
       set amount = -new.amount, note = new.category, entry_date = new.expense_date
     where kharcha_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists kharcha_wallet_insert on public.kharcha;
create trigger kharcha_wallet_insert
  after insert on public.kharcha
  for each row execute function public.sync_wallet_entry_for_kharcha();

drop trigger if exists kharcha_wallet_update on public.kharcha;
create trigger kharcha_wallet_update
  after update on public.kharcha
  for each row execute function public.sync_wallet_entry_for_kharcha();

-- Backfill: existing expenses get their matching wallet entry too.
insert into public.wallet_entries (org_id, user_id, amount, note, kharcha_id, created_by, entry_date, created_at)
select org_id, owner_id, -amount, category, id, owner_id, expense_date, created_at
from public.kharcha
on conflict (kharcha_id) do nothing;
