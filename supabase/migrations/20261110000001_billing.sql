-- The link between an account and its Dodo Payments subscription. The plan
-- itself stays on profiles (plan, plan_renews_at), which record_download reads.
-- Only the Edge Functions write here; members can read their own row, to show
-- their renewal date.
create table if not exists public.billing (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  email                text,
  customer_id          text,
  subscription_id      text,
  product_id           text,
  status               text,
  cancel_at_period_end boolean not null default false,
  current_period_end   timestamptz,
  -- webhooks can arrive late or twice; older ones are ignored
  last_event_at        timestamptz,
  updated_at           timestamptz not null default now()
);

create index if not exists billing_subscription_idx on public.billing (subscription_id);
create index if not exists billing_email_idx on public.billing (lower(email));

alter table public.billing enable row level security;

drop policy if exists "members read their own billing" on public.billing;
create policy "members read their own billing"
  on public.billing for select
  using (user_id = auth.uid());

grant select on public.billing to authenticated;
grant all on public.billing to service_role;
