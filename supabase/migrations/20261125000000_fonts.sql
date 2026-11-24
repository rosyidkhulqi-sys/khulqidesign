-- Fonts: the owner's own typefaces, sold per item as on Creative Market
-- (not part of the subscription). A font is one family package (OTF, TTF,
-- WOFF2 and the license file in one ZIP) with a specimen picture as its
-- preview. Its own codes (KD-FN-…), month numbers (FN 1126 1) and batch
-- prefix follow the other types.
--
--   license 'paid'   bought per item; a Premium plan doesn't unlock it
--   prices           USD per license tier, e.g.
--                    {"desktop": 19, "web": 39, "app": 79, "extended": 149}

alter table public.assets drop constraint assets_type_check;
alter table public.assets add constraint assets_type_check
  check (type in ('icon', 'vector', 'logo', 'footage', 'template', 'element', 'photo', 'mockup', 'font'));

alter table public.assets drop constraint assets_license_check;
alter table public.assets add constraint assets_license_check
  check (license in ('free', 'premium', 'exclusive', 'paid'));

alter table public.assets add column if not exists prices jsonb;

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
    when p_type = 'font'     then 'FN'
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
    when 'photo' then 'PH' when 'mockup' then 'MK' when 'font' then 'FN'
    else 'AS' end;
$$;

-- the download gate learns 'paid': only admins until purchases exist (a
-- paid font must never fall through to the free branch)
create or replace function public.record_download(p_asset uuid, p_format text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  a public.assets;
  member_role text := 'member';
  member_plan text := 'free';
  renews timestamptz;
  file jsonb;
  taken int;
  daily int;
  granted text;
begin
  if uid is null then
    raise exception 'sign_in_required';
  end if;

  select * into a from public.assets where id = p_asset and status = 'published';
  if not found then
    raise exception 'not_found';
  end if;

  select x into file
  from jsonb_array_elements(a.files) as x
  where upper(x ->> 'format') = upper(p_format)
  limit 1;
  if file is null then
    raise exception 'format_not_found';
  end if;

  select role, plan, plan_renews_at into member_role, member_plan, renews
  from public.profiles where id = uid;
  member_role := coalesce(member_role, 'member');
  member_plan := coalesce(member_plan, 'free');
  -- a plan past its renewal date counts as Free
  if member_plan <> 'free' and renews is not null and renews < now() then
    member_plan := 'free';
  end if;

  if member_role = 'admin' then
    granted := case a.license when 'free' then 'free' when 'exclusive' then 'exclusive' else 'standard' end;
  else
    if a.license = 'exclusive' then
      if a.sold_to is distinct from uid then
        raise exception 'purchase_required';
      end if;
      granted := 'exclusive';
    elsif a.license = 'paid' then
      -- per-item purchases come with payments; until then, no one but admins
      raise exception 'purchase_required';
    elsif a.license = 'premium' then
      if member_plan not in ('premium', 'founding') then
        raise exception 'premium_required';
      end if;
      granted := 'standard';
    else
      granted := case when member_plan in ('premium', 'founding') then 'standard' else 'free' end;
    end if;

    daily := case when member_plan in ('premium', 'founding') then 100 else 10 end;
    select count(distinct asset_id) into taken
    from public.downloads
    where user_id = uid
      and created_at >= date_trunc('day', now())
      and asset_id <> a.id;
    if taken >= daily then
      raise exception 'daily_limit';
    end if;
  end if;

  insert into public.downloads (user_id, asset_id, format, license)
  values (uid, a.id, upper(p_format), granted);

  update public.assets set downloads = downloads + 1 where id = a.id;

  return jsonb_build_object(
    'key', file ->> 'key',
    'license', granted,
    'code', a.code,
    'title', a.title,
    'format', upper(p_format)
  );
end;
$$;

revoke all on function public.record_download(uuid, text) from public, anon;
grant execute on function public.record_download(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
