-- Allow authenticated users with folder write access to upload documents
CREATE POLICY "Users with write access can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND has_folder_write_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Allow users with write access to delete their uploaded documents
CREATE POLICY "Users with write access can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND has_folder_write_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Allow users with write access to update documents
CREATE POLICY "Users with write access can update documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND has_folder_write_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);