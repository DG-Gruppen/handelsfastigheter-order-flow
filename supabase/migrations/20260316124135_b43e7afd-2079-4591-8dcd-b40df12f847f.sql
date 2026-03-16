
-- Add write_roles column to document_folders
ALTER TABLE public.document_folders ADD COLUMN write_roles text[] DEFAULT NULL;

-- Create a security definer function to check write access
CREATE OR REPLACE FUNCTION public.has_folder_write_access(_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _write_roles text[];
BEGIN
  SELECT write_roles INTO _write_roles FROM public.document_folders WHERE id = _folder_id;
  -- If write_roles is NULL, only admins can write (default behavior)
  IF _write_roles IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role::text = ANY(_write_roles)
  );
END;
$$;

-- Update file INSERT policy: admins OR users with write access to the folder
DROP POLICY IF EXISTS "Admins can insert files" ON public.document_files;
CREATE POLICY "Users with write access can insert files" ON public.document_files
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_folder_write_access(auth.uid(), folder_id)
);

-- Update file UPDATE policy
DROP POLICY IF EXISTS "Admins can update files" ON public.document_files;
CREATE POLICY "Users with write access can update files" ON public.document_files
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_folder_write_access(auth.uid(), folder_id)
);

-- Update file DELETE policy
DROP POLICY IF EXISTS "Admins can delete files" ON public.document_files;
CREATE POLICY "Users with write access can delete files" ON public.document_files
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_folder_write_access(auth.uid(), folder_id)
);

-- Update folder INSERT policy: admins OR users with write access to parent
DROP POLICY IF EXISTS "Admins can insert folders" ON public.document_folders;
CREATE POLICY "Users with write access can insert folders" ON public.document_folders
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (parent_id IS NOT NULL AND has_folder_write_access(auth.uid(), parent_id))
);

-- Update folder UPDATE policy
DROP POLICY IF EXISTS "Admins can update folders" ON public.document_folders;
CREATE POLICY "Users with write access can update folders" ON public.document_folders
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_folder_write_access(auth.uid(), id)
);

-- Update folder DELETE policy
DROP POLICY IF EXISTS "Admins can delete folders" ON public.document_folders;
CREATE POLICY "Users with write access can delete folders" ON public.document_folders
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_folder_write_access(auth.uid(), id)
);

-- Update storage policy for documents bucket to allow write-access users to upload
-- (Storage policies are managed separately, but the RLS on document_files handles the metadata)
