-- Members can clear their download history. The rows stay: they are the
-- proof of license and the count behind the daily limit, so "removing" one
-- only hides it from the member's own list.
alter table public.downloads add column hidden_at timestamptz;

-- p_ids: the rows to hide, or null for the member's whole history.
-- Returns how many rows were hidden. Members have no update right on this
-- table, so this is the only way in, and it only touches their own rows.
create or replace function public.hide_downloads(p_ids bigint[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  hidden integer;
begin
  if auth.uid() is null then
    raise exception 'sign_in_required';
  end if;

  update public.downloads
     set hidden_at = now()
   where user_id = auth.uid()
     and hidden_at is null
     and (p_ids is null or id = any (p_ids));

  get diagnostics hidden = row_count;
  return hidden;
end;
$$;

revoke all on function public.hide_downloads(bigint[]) from public, anon;
grant execute on function public.hide_downloads(bigint[]) to authenticated;

notify pgrst, 'reload schema';
