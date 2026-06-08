
CREATE POLICY "Users can upload own passport"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'supermalet-passports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own passport, admin/IT all"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'supermalet-passports'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_in_admin_group(auth.uid())
      OR public.has_role(auth.uid(), 'it'::app_role)
    )
  );

CREATE POLICY "Users can update own passport"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'supermalet-passports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own passport, admin/IT all"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'supermalet-passports'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_in_admin_group(auth.uid())
      OR public.has_role(auth.uid(), 'it'::app_role)
    )
  );
