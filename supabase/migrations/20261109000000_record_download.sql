-- record_download: the one gate every download of an original passes.
-- Called by the r2-sign Edge Function with the buyer's own session; it
-- decides whether this person may take this file now, writes the download
-- row (their proof of license) and returns the private object key, which
-- the function then signs as a short-lived link.
--
--   free asset       any signed-in account
--   premium asset    an active Premium or Founding plan
--   exclusive logo   only its buyer (sold_to)
--   daily limit      Free 10 assets a day, Premium 100 (fair use), counted
--                    per UTC day; taking the same asset again doesn't count
--   admins           no limits, so the owner can check any file
--
-- Errors are raised with a plain code as the message, for the site to show:
-- sign_in_required, not_found, format_not_found, premium_required,
-- purchase_required, daily_limit.
--
-- Run once in Supabase: SQL Editor -> paste this file -> Run.

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

-- downloads left today for the signed-in account, for the Account page
create or replace function public.downloads_today()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'taken', (select count(distinct asset_id) from public.downloads
              where user_id = auth.uid() and created_at >= date_trunc('day', now())),
    'limit', case when coalesce((select plan from public.profiles where id = auth.uid()), 'free') in ('premium', 'founding')
                  then 100 else 10 end
  );
$$;

revoke all on function public.downloads_today() from public, anon;
grant execute on function public.downloads_today() to authenticated;

-- make the API see the new functions right away
notify pgrst, 'reload schema';
