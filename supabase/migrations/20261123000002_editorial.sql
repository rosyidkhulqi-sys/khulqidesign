-- Editorial use only: photos with recognizable people, brands or private
-- places shown without a release, or news events. As on Adobe Stock and
-- Shutterstock they may illustrate articles, blogs and education, never ads,
-- packaging or merchandise.
alter table public.assets add column if not exists editorial boolean not null default false;
