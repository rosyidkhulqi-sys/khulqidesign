-- Icon sets carry what their icons share: a description, a default license
-- and keywords that every icon in the set is found by.
-- Run once in Supabase: SQL Editor -> paste this file -> Run.

alter table public.asset_sets
  add column if not exists description text,
  add column if not exists license text not null default 'free'
    check (license in ('free', 'premium', 'exclusive')),
  add column if not exists keywords text[] not null default '{}';

create index if not exists asset_sets_type_status_idx
  on public.asset_sets (type, status, created_at desc);
