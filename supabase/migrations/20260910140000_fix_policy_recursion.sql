-- ============================================================================
-- Fix: mutual RLS recursion between kharcha and kharcha_shares
-- ============================================================================
-- kharcha_select referenced kharcha_shares, whose policies referenced kharcha:
-- Postgres raises 42P17 (infinite recursion) as soon as either is evaluated.
-- SECURITY DEFINER helpers evaluate the cross-table lookup without RLS, which
-- breaks the cycle. Each only answers a yes/no about the caller's own access.

create or replace function public.is_shared_with_me(k_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.kharcha_shares
    where kharcha_id = k_id and shared_with = auth.uid()
  );
$$;

revoke execute on function public.is_shared_with_me(uuid) from public, anon;
grant  execute on function public.is_shared_with_me(uuid) to authenticated;

drop policy if exists kharcha_select on public.kharcha;
create policy kharcha_select on public.kharcha
  for select to authenticated
  using (
    (select auth.uid()) = owner_id
    or public.is_shared_with_me(id)
  );

drop policy if exists shares_select on public.kharcha_shares;
create policy shares_select on public.kharcha_shares
  for select to authenticated
  using (
    (select auth.uid()) = shared_with
    or public.owns_kharcha(kharcha_id)
  );

drop policy if exists shares_insert on public.kharcha_shares;
create policy shares_insert on public.kharcha_shares
  for insert to authenticated
  with check (
    public.owns_kharcha(kharcha_id)
    and (select auth.uid()) = shared_by
  );

drop policy if exists shares_delete on public.kharcha_shares;
create policy shares_delete on public.kharcha_shares
  for delete to authenticated
  using (public.owns_kharcha(kharcha_id));
