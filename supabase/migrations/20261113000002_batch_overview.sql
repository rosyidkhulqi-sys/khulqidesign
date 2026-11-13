-- One row per upload batch of a type, for the Batches view on /admin: how
-- many assets it holds, how many are on the site, and a picture to know it by.
create or replace function public.batch_overview(p_type text)
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  total bigint,
  published bigint,
  hidden bigint,
  thumb_key text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  return query
  select b.id, b.name, b.created_at,
         count(a.id),
         count(a.id) filter (where a.status = 'published'),
         count(a.id) filter (where a.status <> 'published'),
         (select a2.thumb_key from public.assets a2
           where a2.batch_id = b.id and a2.thumb_key is not null
           order by a2.created_at desc limit 1)
  from public.upload_batches b
  left join public.assets a on a.batch_id = b.id
  where b.type = p_type
  group by b.id
  order by b.created_at desc;
end;
$$;

revoke execute on function public.batch_overview(text) from public, anon;
grant execute on function public.batch_overview(text) to authenticated;
