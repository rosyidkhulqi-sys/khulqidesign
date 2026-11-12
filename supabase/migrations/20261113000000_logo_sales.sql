-- Exclusive logos bought through Dodo Payments. Each logo becomes its own
-- fixed-price Dodo product the first time someone starts a checkout, a logo
-- is held for one buyer while they pay, and the webhook marks it sold.

-- the Dodo product for each logo, per mode (test and live keep their own)
create table if not exists public.dodo_logo_products (
  asset_id    uuid not null references public.assets (id) on delete cascade,
  mode        text not null check (mode in ('test', 'live')),
  product_id  text not null,
  price_cents integer not null,
  created_at  timestamptz not null default now(),
  primary key (asset_id, mode)
);

create table if not exists public.logo_orders (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references public.assets (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  email       text,
  mode        text not null check (mode in ('test', 'live')),
  product_id  text not null,
  price_cents integer not null,
  -- pending: checkout open; paid: sold to this buyer; expired: abandoned;
  -- conflict: paid after someone else bought it (refund by hand)
  status      text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'conflict')),
  payment_id  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- one open checkout per logo, so two people can't pay for the same one
create unique index if not exists logo_orders_one_pending
  on public.logo_orders (asset_id) where status = 'pending';
create index if not exists logo_orders_user_idx on public.logo_orders (user_id);

-- every webhook as it arrived: an audit trail, and duplicates are skipped
create table if not exists public.dodo_events (
  id          text primary key,
  type        text,
  payload     jsonb,
  received_at timestamptz not null default now()
);

alter table public.dodo_logo_products enable row level security;
alter table public.logo_orders enable row level security;
alter table public.dodo_events enable row level security;

drop policy if exists "members read their own logo orders" on public.logo_orders;
create policy "members read their own logo orders"
  on public.logo_orders for select
  using (user_id = auth.uid());

grant select on public.logo_orders to authenticated;
grant all on public.dodo_logo_products, public.logo_orders, public.dodo_events to service_role;
