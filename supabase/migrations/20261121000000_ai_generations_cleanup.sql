-- The Privacy Policy promises AI requests are deleted after 12 months.
-- pg_cron deletes older rows every night at 03:17 UTC.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'ai-generations-cleanup',
  '17 3 * * *',
  $$delete from public.ai_generations where created_at < now() - interval '12 months'$$
);
