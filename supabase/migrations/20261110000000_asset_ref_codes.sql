-- A short working code for every asset, for finding it again on /admin:
-- type, month and year of upload, then a running number, e.g. BG 1126 130.
-- The public KD-... code stays what licenses and downloads refer to.
-- source_name keeps the original file name, so it can be searched too.

alter table public.assets
  add column if not exists ref_code text,
  add column if not exists source_name text;

create unique index if not exists assets_ref_code_idx
  on public.assets (ref_code) where ref_code is not null;

-- one row per type and month; only the functions below touch it, so RLS is
-- on with no policies
create table if not exists public.asset_ref_counters (
  prefix      text not null,
  period      text not null,
  last_number integer not null default 0,
  primary key (prefix, period)
);
alter table public.asset_ref_counters enable row level security;

create or replace function public.next_asset_ref(p_type text, p_style text, p_at timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text := case
    when p_type = 'element' and p_style = 'background' then 'BG'
    when p_type = 'element'  then 'EL'
    when p_type = 'icon'     then 'IC'
    when p_type = 'vector'   then 'VC'
    when p_type = 'logo'     then 'LG'
    when p_type = 'footage'  then 'FT'
    when p_type = 'template' then 'TP'
    else 'AS'
  end;
  -- the month as the owner sees it, in Indonesia
  v_period text := to_char(p_at at time zone 'Asia/Jakarta', 'MMYY');
  v_number integer;
begin
  -- a deleted asset's number is never given out again
  insert into public.asset_ref_counters as c (prefix, period, last_number)
  values (v_prefix, v_period, 1)
  on conflict (prefix, period) do update set last_number = c.last_number + 1
  returning c.last_number into v_number;
  return v_prefix || ' ' || v_period || ' ' || v_number;
end;
$$;

revoke execute on function public.next_asset_ref(text, text, timestamptz) from public, anon, authenticated;

create or replace function public.set_asset_ref()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ref_code is null then
    new.ref_code := public.next_asset_ref(new.type, new.style, coalesce(new.created_at, now()));
  end if;
  return new;
end;
$$;

revoke execute on function public.set_asset_ref() from public, anon, authenticated;

drop trigger if exists assets_set_ref on public.assets;
create trigger assets_set_ref
  before insert on public.assets
  for each row execute function public.set_asset_ref();

-- assets already uploaded, oldest first
do $$
declare
  r record;
begin
  for r in select id, type, style, created_at from public.assets where ref_code is null order by created_at loop
    update public.assets
      set ref_code = public.next_asset_ref(r.type, r.style, r.created_at)
      where id = r.id;
  end loop;
end;
$$;
