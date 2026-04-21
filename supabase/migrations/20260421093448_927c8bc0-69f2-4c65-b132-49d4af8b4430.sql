-- Add missing KPI types: Vakansgrad and Fastighetsvärde
INSERT INTO kpi_types (slug, name, unit, format, higher_is_better, sort_order)
VALUES 
  ('vakansgrad', 'Vakansgrad', '%', 'percent', false, 3),
  ('fastighetsvarde', 'Fastighetsvärde', 'mkr', 'currency_bn', true, 4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  unit = EXCLUDED.unit,
  format = EXCLUDED.format,
  higher_is_better = EXCLUDED.higher_is_better,
  sort_order = EXCLUDED.sort_order,
  is_active = true;