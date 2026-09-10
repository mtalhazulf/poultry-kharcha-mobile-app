-- ============================================================================
-- Hardening pass driven by Supabase security/performance advisors.
-- ============================================================================

-- Pin search_path on the two functions the linter flagged.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.safe_uuid(text)  set search_path = public, pg_temp;

-- Trigger functions are fired by the database, never by clients; remove them
-- from the PostgREST RPC surface entirely.
revoke execute on function public.handle_new_user()          from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.set_updated_at()           from public, anon, authenticated;
revoke execute on function public.safe_uuid(text)            from public, anon;

-- can_access_kharcha / owns_kharcha intentionally stay executable by
-- `authenticated`: storage policies evaluate them as the calling user, and
-- they only ever report on the caller's own access.

-- Covering index for kharcha_shares.shared_by (FK cascade + "shared by me" lookups).
create index if not exists idx_shares_shared_by
  on public.kharcha_shares (shared_by);
