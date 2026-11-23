-- Batch names with one space between words, so "PH  P 0714" and "PH P 0714"
-- are the same batch; earlier names were tidied and the split batch merged.
create or replace function public.open_upload_batch(p_type text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
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
