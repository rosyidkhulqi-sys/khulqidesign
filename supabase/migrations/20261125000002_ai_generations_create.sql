-- Create's AI tab (admin trial): AI elements and AI text, logged with their
-- cost like the other AI tools.
alter table public.ai_generations drop constraint ai_generations_kind_check;
alter table public.ai_generations add constraint ai_generations_kind_check
  check (kind in ('template', 'resize', 'svg_edit', 'create_element', 'create_text'));
