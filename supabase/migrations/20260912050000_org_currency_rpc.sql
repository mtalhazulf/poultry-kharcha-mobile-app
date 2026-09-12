create or replace function public.set_organization_currency(p_org uuid, p_currency text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_currency text := upper(btrim(coalesce(p_currency, '')));
begin
  if not public.is_org_admin(p_org) then
    raise exception 'Only an admin can change the currency' using errcode = '42501';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Currency must be a 3-letter code' using errcode = '23514';
  end if;

  update public.organizations o set currency = v_currency where o.id = p_org;

  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.set_organization_currency(uuid, text) from public, anon;
grant execute on function public.set_organization_currency(uuid, text) to authenticated;
