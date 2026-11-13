-- AI resize (rearranging a design for a new format) is logged like templates.
alter table public.ai_generations drop constraint ai_generations_kind_check;
alter table public.ai_generations add constraint ai_generations_kind_check
  check (kind in ('template', 'resize'));
