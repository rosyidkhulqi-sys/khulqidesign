-- How many published assets each library has, in one request, for Home's
-- counters. Runs as the caller, so the usual row rules apply (only
-- published assets are readable by visitors anyway).
create or replace function public.asset_counts()
returns table (type text, n bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select a.type, count(*) from public.assets a where a.status = 'published' group by a.type
$$;

grant execute on function public.asset_counts() to anon, authenticated;
