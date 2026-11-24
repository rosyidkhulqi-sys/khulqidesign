-- A font shows several preview pictures, as on Creative Market: every one,
-- the cover first, as [{ key, width, height }] in the public bucket.
alter table public.assets add column if not exists gallery jsonb;

notify pgrst, 'reload schema';
