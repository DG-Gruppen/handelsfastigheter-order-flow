-- Remove "Planerat underhåll" KPI (data + type)
DELETE FROM public.kpi_data WHERE kpi_type_id = (SELECT id FROM public.kpi_types WHERE slug = 'planerat_underhall');
DELETE FROM public.kpi_types WHERE slug = 'planerat_underhall';

-- Add "Optioner" (aktiekurs i kr per aktie) and "Duration" (år)
INSERT INTO public.kpi_types (slug, name, format, unit, sort_order, higher_is_better, is_active)
VALUES
  ('optioner', 'Optioner', 'currency', 'kr', 4, true, true),
  ('duration', 'Duration', 'count', 'år', 5, true, true)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      format = EXCLUDED.format,
      unit = EXCLUDED.unit,
      sort_order = EXCLUDED.sort_order,
      higher_is_better = EXCLUDED.higher_is_better,
      is_active = true;