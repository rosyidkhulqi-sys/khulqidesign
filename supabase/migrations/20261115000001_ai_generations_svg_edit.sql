-- AI SVG edit (Edit an image, step two: swap parts or extend an SVG with
-- Claude) is logged like templates and resizes.
alter table public.ai_generations drop constraint ai_generations_kind_check;
alter table public.ai_generations add constraint ai_generations_kind_check
  check (kind in ('template', 'resize', 'svg_edit'));
