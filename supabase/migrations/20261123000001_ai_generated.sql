-- Marks an asset made with generative AI. Shown as an "AI" label and
-- filterable, as on Magnific and Adobe Stock, and required by the EU AI Act
-- for AI-made images offered to the public.
alter table public.assets add column if not exists ai_generated boolean not null default false;
create index if not exists assets_ai_idx on public.assets (type, ai_generated) where status = 'published';
