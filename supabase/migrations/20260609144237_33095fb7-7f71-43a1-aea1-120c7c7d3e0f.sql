CREATE POLICY "Admin/IT can upload supermalet export" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'supermalet-exports' AND (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'it'::app_role)));

CREATE POLICY "Admin/IT can read supermalet export" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'supermalet-exports' AND (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'it'::app_role)));

CREATE POLICY "Admin/IT can delete supermalet export" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'supermalet-exports' AND (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'it'::app_role)));