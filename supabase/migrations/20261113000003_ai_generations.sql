-- Every AI generation, kept so the system can be tuned from real data:
-- what was asked (the brief), what came back, what it cost and whether the
-- person went on to use it (opened it in Create). Only the ai-* Edge
-- Functions write rows, with the service role; people can read their own,
-- and admins all of them.

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('template')),
  prompt text not null,
  brief jsonb not null default '{}'::jsonb,
  result jsonb,
  -- what the layout check found and whether a second pass fixed it
  checks jsonb not null default '{}'::jsonb,
  model text,
  input_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 5) not null default 0,
  seconds numeric(6, 1),
  status text not null default 'ok' check (status in ('ok', 'failed', 'refused')),
  opened_at timestamptz,
  created_at timestamptz not null default now()
);

create index ai_generations_user_idx on public.ai_generations (user_id, created_at desc);
create index ai_generations_created_idx on public.ai_generations (created_at desc);

alter table public.ai_generations enable row level security;

create policy "own or admin can read generations"
  on public.ai_generations for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- the owner marks a design as used when they open it in Create
create function public.mark_generation_opened(generation uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_generations
     set opened_at = coalesce(opened_at, now())
   where id = generation and user_id = auth.uid();
$$;

revoke all on function public.mark_generation_opened(uuid) from public, anon;
grant execute on function public.mark_generation_opened(uuid) to authenticated;
