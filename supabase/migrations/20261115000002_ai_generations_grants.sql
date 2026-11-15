-- ai_generations never got table grants (this project doesn't add them to
-- new tables by itself, as brand_kits showed), so the Edge Functions' service
-- role couldn't insert, and every log was refused quietly: the table stayed
-- empty. The service role writes and reads it; signed-in people may read
-- their own rows (and admins all of them), as the policy already says.
grant select, insert, update on public.ai_generations to service_role;
grant select on public.ai_generations to authenticated;
