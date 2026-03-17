INSERT INTO public.modules (name, slug, route, icon, description, sort_order, is_active)
VALUES ('Kulturen', 'kulturen', '/kulturen', 'heart', 'Det som gör SHF till SHF – erkännanden, veckans vinst och karriärvägar', 55, true)
ON CONFLICT DO NOTHING;