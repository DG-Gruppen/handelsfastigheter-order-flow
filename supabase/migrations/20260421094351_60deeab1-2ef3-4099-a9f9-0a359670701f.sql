
UPDATE public.kpi_data SET region_id = '09e28ef0-c0ab-48dc-90d6-4b276e7d3433', region_name = 'Mitt/Bromma'
  WHERE region_id = '09e28ef0-c0ab-48dc-90d6-4b276e7d3433' OR region_name IN ('Mitt','Mitt/Bromma','Region Mitt/Bromma','Region Mitt');
UPDATE public.kpi_data SET region_id = 'd6b617de-9191-46d9-80a6-210fdc172fe5', region_name = 'Norr'
  WHERE region_id = 'd6b617de-9191-46d9-80a6-210fdc172fe5' OR region_name IN ('Norr','Region Norr');
UPDATE public.kpi_data SET region_id = '1cdf6e7f-a8bb-4913-9005-ee7a2cb6d190', region_name = 'Söder'
  WHERE region_id = '1cdf6e7f-a8bb-4913-9005-ee7a2cb6d190' OR region_name IN ('Söder','Syd','Region Söder','Region Syd');
