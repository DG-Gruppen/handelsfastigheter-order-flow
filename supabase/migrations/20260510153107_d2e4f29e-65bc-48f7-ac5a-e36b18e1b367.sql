-- Steg 1: Documents bucket - använd folder ACL
DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read documents" ON storage.objects;

CREATE POLICY "Folder ACL controls documents read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    public.is_in_admin_group(auth.uid())
    OR public.has_role(auth.uid(), 'it'::app_role)
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
      AND public.has_folder_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);

-- Steg 2: kb-images DELETE - endast admin/IT eller redaktörer för kunskapsbanken
DROP POLICY IF EXISTS "Authenticated users can delete kb images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete kb images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete kb images" ON storage.objects;

CREATE POLICY "Restricted kb-images delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'kb-images'
  AND (
    public.is_in_admin_group(auth.uid())
    OR public.has_role(auth.uid(), 'it'::app_role)
    OR public.has_module_slug_permission(auth.uid(), 'kunskapsbanken', 'edit')
  )
);