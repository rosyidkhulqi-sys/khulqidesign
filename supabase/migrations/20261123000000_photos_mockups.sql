-- Two new libraries: photos (a JPG original, sold full size) and mockups
-- (a PSD with a JPG preview, as on Magnific and Envato). Their own codes
-- (KD-PH-…, KD-MK-…), the owner's month numbers (PH 1126 1, MK 1126 1) and
-- batch prefixes follow the other types.

alter table public.assets drop constraint assets_type_check;
alter table public.assets add constraint assets_type_check
  check (type in ('icon', 'vector', 'logo', 'footage', 'template', 'element', 'photo', 'mockup'));

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
    when p_type = 'photo'    then 'PH'
    when p_type = 'mockup'   then 'MK'
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

create or replace function public.batch_prefix(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'vector' then 'VC' when 'icon' then 'IC' when 'logo' then 'LG'
    when 'footage' then 'FT' when 'template' then 'TP' when 'element' then 'EL'
    when 'photo' then 'PH' when 'mockup' then 'MK'
    else 'AS' end;
$$;
