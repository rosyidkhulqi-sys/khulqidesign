-- Upload batches: every upload on /admin goes into a named batch (the owner
-- types one, such as "M 1026", or a dated one is made), so thousands of
-- assets can be found, hidden or removed a batch at a time.

create table if not exists public.upload_batches (
  id         uuid primary key default gen_random_uuid(),
  type       text not null,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (type, name)
);

alter table public.assets
  add column if not exists batch_id uuid references public.upload_batches (id) on delete set null;
create index if not exists assets_batch_idx on public.assets (batch_id);

alter table public.upload_batches enable row level security;
drop policy if exists "admins manage batches" on public.upload_batches;
create policy "admins manage batches"
  on public.upload_batches for all
  using (public.is_admin())
  with check (public.is_admin());
grant select, insert, update, delete on public.upload_batches to authenticated;
grant all on public.upload_batches to service_role;

create or replace function public.batch_prefix(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'vector' then 'VC' when 'icon' then 'IC' when 'logo' then 'LG'
    when 'footage' then 'FT' when 'template' then 'TP' when 'element' then 'EL'
    else 'AS' end;
$$;

-- the batch to upload into: the named one (made if new, reused if it
-- exists, so a batch can grow later), or today's dated one
create or replace function public.open_upload_batch(p_type text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(p_name), '');
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  v_name := coalesce(
    left(v_name, 80),
    public.batch_prefix(p_type) || ' ' || to_char(now() at time zone 'Asia/Jakarta', 'DD Mon YYYY')
  );
  insert into public.upload_batches (type, name) values (p_type, v_name)
  on conflict (type, name) do update set name = excluded.name
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.open_upload_batch(text, text) from public, anon;
grant execute on function public.open_upload_batch(text, text) to authenticated;

-- assets uploaded before batches: one batch per type and upload day
insert into public.upload_batches (type, name, created_at)
select type,
       public.batch_prefix(type) || ' ' || to_char(created_at at time zone 'Asia/Jakarta', 'DD Mon YYYY'),
       min(created_at)
from public.assets
where batch_id is null
group by 1, 2
on conflict (type, name) do nothing;

update public.assets a
set batch_id = b.id
from public.upload_batches b
where a.batch_id is null
  and b.type = a.type
  and b.name = public.batch_prefix(a.type) || ' ' || to_char(a.created_at at time zone 'Asia/Jakarta', 'DD Mon YYYY');
