-- Brand kit: a Premium member's official colors, fonts and logos, kept with
-- their account so every design (and every device) can use them.

-- true for a paid plan that hasn't lapsed, or an admin; the same rule the
-- site uses for Premium tools (lib/billing.js canUsePremium)
create function public.has_premium()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and (role = 'admin'
            or (plan <> 'free' and (plan_renews_at is null or plan_renews_at > now())))
  );
$$;

revoke all on function public.has_premium() from public, anon;
grant execute on function public.has_premium() to authenticated;

create table public.brand_kits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- up to 12 hex colors
  colors text[] not null default '{}' check (cardinality(colors) <= 12),
  heading_font text,
  body_font text,
  -- up to 6 small logos: [{ name, src }], src a data: URL
  logos jsonb not null default '[]'::jsonb
    check (jsonb_typeof(logos) = 'array' and jsonb_array_length(logos) <= 6 and octet_length(logos::text) <= 3000000),
  updated_at timestamptz not null default now()
);

alter table public.brand_kits enable row level security;

-- members read their own kit (kept even if Premium lapses, so nothing is lost)
create policy "read own brand kit"
  on public.brand_kits for select to authenticated
  using (user_id = auth.uid());

-- only Premium members save one
create policy "premium saves own brand kit"
  on public.brand_kits for insert to authenticated
  with check (user_id = auth.uid() and public.has_premium());
create policy "premium updates own brand kit"
  on public.brand_kits for update to authenticated
  using (user_id = auth.uid() and public.has_premium())
  with check (user_id = auth.uid() and public.has_premium());
create policy "remove own brand kit"
  on public.brand_kits for delete to authenticated
  using (user_id = auth.uid());
