ALTER TABLE public.kpi_data ADD COLUMN IF NOT EXISTS stretch numeric;
ALTER TABLE public.kpi_types ADD COLUMN IF NOT EXISTS budget_label text NOT NULL DEFAULT 'Budget';

UPDATE public.kpi_types SET name = 'Driftnetto exkl. underhåll & tomträtt' WHERE slug = 'driftnetto';
UPDATE public.kpi_types SET name = 'Överskottsgrad exkl. underhåll & tomträtt' WHERE slug = 'overskottsgrad';
UPDATE public.kpi_types SET budget_label = 'Mål' WHERE slug IN ('vakansgrad','direktavkastning');

UPDATE public.kpi_data SET budget = budget / 1000, actual = actual / 1000, stretch = stretch / 1000
  WHERE kpi_type_id = (SELECT id FROM public.kpi_types WHERE slug = 'fastighetsvarde');
UPDATE public.kpi_types SET unit = 'mdr' WHERE slug = 'fastighetsvarde';

INSERT INTO public.kpi_types (slug, name, unit, format, sort_order, higher_is_better, is_active)
VALUES
  ('nettouthyrning', 'Nettouthyrning', 'mkr', 'currency', 7, true, true),
  ('antal_kontrakt', 'Antal nytecknade kontrakt', 'st', 'count', 8, true, true)
ON CONFLICT (slug) DO NOTHING;