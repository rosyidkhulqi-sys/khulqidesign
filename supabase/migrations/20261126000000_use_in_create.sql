-- A vector background the owner has checked as clean (no text, one
-- background) shows in Create's Background tab, from its own preview: one
-- upload, used in the library and in Create.
alter table public.assets add column if not exists use_in_create boolean not null default false;

create index if not exists assets_use_in_create_idx
  on public.assets (type, status)
  where use_in_create;
