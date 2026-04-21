-- Replace vakansgrad and fastighetsvarde with antal_fastigheter and direktavkastning
DELETE FROM public.kpi_data WHERE kpi_type_id IN (SELECT id FROM public.kpi_types WHERE slug IN ('vakansgrad','fastighetsvarde'));
DELETE FROM public.kpi_types WHERE slug IN ('vakansgrad','fastighetsvarde');

INSERT INTO public.kpi_types (slug, name, unit, format, sort_order, higher_is_better, is_active)
VALUES
  ('antal_fastigheter', 'Fastigheter', 'st', 'count', 30, true, true),
  ('direktavkastning', 'Direktavkastning', '%', 'percent', 40, true, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  unit = EXCLUDED.unit,
  format = EXCLUDED.format,
  sort_order = EXCLUDED.sort_order,
  higher_is_better = EXCLUDED.higher_is_better,
  is_active = true;