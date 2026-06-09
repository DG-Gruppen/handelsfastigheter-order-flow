DELETE FROM public.module_role_access
WHERE module_id = (SELECT id FROM public.modules WHERE slug = 'supermalet');