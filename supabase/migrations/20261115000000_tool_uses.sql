-- Daily limits for the free in-browser tools. Remove background runs on the
-- visitor's device, so it costs us nothing, but Free includes 5 a day and
-- Premium is unlimited (see the Pricing page). The count lives here, so it
-- can't be reset from the browser. Days are UTC.

create table public.tool_uses (
  user_id uuid not null references auth.users (id) on delete cascade,
  tool text not null check (tool in ('remove_background')),
  day date not null default (now() at time zone 'utc')::date,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, tool, day)
);

-- only the two functions below touch it
alter table public.tool_uses enable row level security;

-- the free daily allowance of a tool; null = no limit
create function public.tool_limit(p_tool text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.has_premium() then null
    when p_tool = 'remove_background' then 5
  end;
$$;

-- today's use of a tool: { used, limit } (limit null = unlimited)
create function public.tool_quota(p_tool text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign_in_required';
  end if;
  return json_build_object(
    'used', coalesce((select count from public.tool_uses
                       where user_id = auth.uid() and tool = p_tool
                         and day = (now() at time zone 'utc')::date), 0),
    'limit', public.tool_limit(p_tool)
  );
end;
$$;

-- counts one use; raises daily_limit when the free allowance is used up
create function public.use_tool(p_tool text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  cap integer := public.tool_limit(p_tool);
  today date := (now() at time zone 'utc')::date;
  n integer;
begin
  if auth.uid() is null then
    raise exception 'sign_in_required';
  end if;
  insert into public.tool_uses (user_id, tool, day, count)
  values (auth.uid(), p_tool, today, 1)
  on conflict (user_id, tool, day) do update
    set count = public.tool_uses.count + 1
    where cap is null or public.tool_uses.count < cap
  returning count into n;
  if n is null then
    raise exception 'daily_limit';
  end if;
  return json_build_object('used', n, 'limit', cap);
end;
$$;

revoke all on function public.tool_limit(text) from public, anon;
revoke all on function public.tool_quota(text) from public, anon;
revoke all on function public.use_tool(text) from public, anon;
grant execute on function public.tool_quota(text) to authenticated;
grant execute on function public.use_tool(text) to authenticated;
