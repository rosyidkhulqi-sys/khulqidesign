-- Khulqidesign: first database schema (phase 1 of the backend).
--
-- What lives here: accounts and roles, the asset catalogue, icon/logo sets
-- and the download log. Files themselves live in Cloudflare R2:
--   public-files   thumbnails and watermarked previews (shown on the site)
--   private-files  originals, handed out only through short-lived signed
--                  links made by an Edge Function after a license check
-- Columns ending in _key hold the object key inside a bucket, never a full
-- URL, so the buckets or the CDN domain can change without touching data.
--
-- Run once in Supabase: SQL Editor -> paste this file -> Run.
-- Making the owner an admin is a separate one-line step (see the end).

-- ---------------------------------------------------------------------------
-- PROFILES: one row per signed-in user, created automatically on sign-up
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- member: everyone; admin: may upload and manage assets
  role         text not null default 'member' check (role in ('member', 'admin')),
  -- set by the payment webhook later, never by the user
  plan         text not null default 'free' check (plan in ('free', 'premium', 'founding')),
  plan_renews_at timestamptz,
  created_at   timestamptz not null default now()
);

-- a profile for every new account
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- true when the signed-in user is an admin; used by the policies below
create function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- users may rename themselves, but never change their own role or plan.
-- Requests from the site run as the anon or authenticated database role;
-- the SQL editor, migrations and Edge Functions (service role) don't, so the
-- owner and the payment webhook can still set roles and plans.
create function public.guard_profile_update()
returns trigger
language plpgsql
as $$
begin
  if (new.role is distinct from old.role or new.plan is distinct from old.plan
      or new.plan_renews_at is distinct from old.plan_renews_at)
     and current_user in ('anon', 'authenticated')
     and not public.is_admin() then
    raise exception 'role and plan can only be changed by the server';
  end if;
  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

alter table public.profiles enable row level security;

create policy "read own profile, admins read all"
  on public.profiles for select
  using ((select auth.uid()) = id or public.is_admin());

create policy "update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- ASSET SETS: icon sets now, logo/brand kits later
-- ---------------------------------------------------------------------------
create table public.asset_sets (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  type        text not null check (type in ('icon', 'logo', 'vector', 'element')),
  name        text not null,
  style       text,
  category    text,
  status      text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  created_at  timestamptz not null default now()
);

alter table public.asset_sets enable row level security;

create policy "anyone reads published sets"
  on public.asset_sets for select
  using (status = 'published' or public.is_admin());

create policy "admins manage sets"
  on public.asset_sets for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ASSETS: one row per sellable item
-- ---------------------------------------------------------------------------
create table public.assets (
  id            uuid primary key default gen_random_uuid(),
  -- the public ID shown on the site, e.g. KD-VC-200013
  code          text not null unique,
  type          text not null check (type in ('icon', 'vector', 'logo', 'footage', 'template', 'element')),
  status        text not null default 'draft' check (status in ('draft', 'published', 'hidden')),

  -- what the page shows
  title         text not null,
  -- from the file's own IPTC/XMP metadata: used for search, never shown
  long_title    text,
  description   text,
  keywords      text[] not null default '{}',

  category      text,
  style         text,
  industry      text,
  set_id        uuid references public.asset_sets (id) on delete set null,

  -- free | premium (non-exclusive, with the plan) | exclusive (one buyer)
  license       text not null default 'free' check (license in ('free', 'premium', 'exclusive')),
  -- exclusive logos only, in US cents
  price_cents   integer check (price_cents is null or price_cents > 0),
  sold_at       timestamptz,
  sold_to       uuid references auth.users (id),

  -- files in R2 (object keys, not URLs)
  thumb_key     text,            -- public-files, ~600 px
  preview_key   text,            -- public-files, ~1500 px, watermarked
  preview_video_key text,        -- public-files, footage hover/preview clip
  -- originals in private-files: [{ "format": "EPS", "key": "...", "bytes": 640690, "label": "Editable vector" }]
  files         jsonb not null default '[]',

  -- specs read on upload
  width         integer,
  height        integer,
  duration_s    numeric(7, 2),
  fps           numeric(6, 2),
  orientation   text check (orientation in ('landscape', 'portrait', 'square')),

  downloads     integer not null default 0,
  search        tsvector,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz,

  -- an exclusive logo needs a price; only exclusive items can be sold
  constraint exclusive_has_price check (license <> 'exclusive' or price_cents is not null),
  constraint only_exclusive_sells check (sold_at is null or license = 'exclusive')
);

-- keep the search vector and timestamps current
create function public.assets_before_write()
returns trigger
language plpgsql
as $$
begin
  new.search :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', array_to_string(new.keywords, ' ')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.long_title, '') || ' ' || coalesce(new.description, '')), 'C');
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger assets_before_write
  before insert or update on public.assets
  for each row execute function public.assets_before_write();

-- the library pages filter by type and status and sort by date or popularity
create index assets_type_status_idx on public.assets (type, status, published_at desc);
create index assets_popular_idx on public.assets (type, downloads desc) where status = 'published';
create index assets_search_idx on public.assets using gin (search);
create index assets_keywords_idx on public.assets using gin (keywords);
create index assets_set_idx on public.assets (set_id);

alter table public.assets enable row level security;

-- visitors see published items; the file list (private keys) is harmless on
-- its own because the private bucket only opens through signed links
create policy "anyone reads published assets"
  on public.assets for select
  using (status = 'published' or public.is_admin());

create policy "admins insert assets"
  on public.assets for insert
  with check (public.is_admin());

create policy "admins update assets"
  on public.assets for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins delete assets"
  on public.assets for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- DOWNLOADS: proof of license and the source of the daily limit
-- ---------------------------------------------------------------------------
create table public.downloads (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  asset_id    uuid not null references public.assets (id) on delete restrict,
  format      text not null,
  -- the license the file was taken under: free | standard | extended | exclusive
  license     text not null check (license in ('free', 'standard', 'extended', 'exclusive')),
  created_at  timestamptz not null default now()
);

-- "downloads today" for the limit, and the Downloads page
create index downloads_user_day_idx on public.downloads (user_id, created_at desc);
create index downloads_asset_idx on public.downloads (asset_id);

alter table public.downloads enable row level security;

-- users read their own history; rows are written only by the download Edge
-- Function with the service role, after it checks the plan and the limit
create policy "read own downloads, admins read all"
  on public.downloads for select
  using ((select auth.uid()) = user_id or public.is_admin());

-- ---------------------------------------------------------------------------
-- PRIVILEGES: the project is created with "Automatically expose new tables"
-- off, so each table states what the site's roles may touch. Row Level
-- Security above still decides which rows.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select on public.assets, public.asset_sets to anon, authenticated;
grant insert, update, delete on public.assets, public.asset_sets to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.downloads to authenticated;

-- Edge Functions (download links, payment webhook) work with the service role
grant all on public.profiles, public.asset_sets, public.assets, public.downloads to service_role;
grant usage on all sequences in schema public to service_role;

grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- After running this file, make the owner an admin (run separately, with the
-- email you sign in with; it isn't kept in git):
--
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'YOUR-EMAIL');
--
-- Accounts created before this file ran have no profile yet; this adds them:
--
--   insert into public.profiles (id, display_name)
--   select id, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name')
--   from auth.users on conflict (id) do nothing;
-- ---------------------------------------------------------------------------
