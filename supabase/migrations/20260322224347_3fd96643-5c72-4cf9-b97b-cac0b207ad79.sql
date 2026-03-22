-- Fix has_folder_access to use has_role() which checks both user_roles AND groups
CREATE OR REPLACE FUNCTION public.has_folder_access(_user_id uuid, _folder_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _roles text[];
BEGIN
  SELECT access_roles INTO _roles FROM public.document_folders WHERE id = _folder_id;
  IF _roles IS NULL THEN RETURN true; END IF;
  -- Check each role using has_role() which supports group-based roles
  RETURN EXISTS (
    SELECT 1 FROM unnest(_roles) AS r(role_name)
    WHERE public.has_role(_user_id, r.role_name::app_role)
  );
END;
$function$;

-- Fix has_folder_write_access similarly
CREATE OR REPLACE FUNCTION public.has_folder_write_access(_user_id uuid, _folder_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _write_roles text[];
  _doc_module_id uuid;
BEGIN
  SELECT write_roles INTO _write_roles FROM public.document_folders WHERE id = _folder_id;

  -- If write_roles is set, check role-based access via has_role (supports groups)
  IF _write_roles IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM unnest(_write_roles) AS r(role_name)
      WHERE public.has_role(_user_id, r.role_name::app_role)
    ) THEN
      RETURN true;
    END IF;
  END IF;

  -- Check module-level edit/owner permission on the documents module
  SELECT id INTO _doc_module_id FROM public.modules WHERE slug = 'documents' LIMIT 1;
  IF _doc_module_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.module_permissions mp
      WHERE mp.module_id = _doc_module_id
        AND mp.grantee_type = 'user'
        AND mp.grantee_id = _user_id
        AND (mp.can_edit = true OR mp.is_owner = true)
    ) THEN
      RETURN true;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.module_permissions mp
      JOIN public.group_members gm ON gm.group_id = mp.grantee_id
      WHERE mp.module_id = _doc_module_id
        AND mp.grantee_type = 'group'
        AND gm.user_id = _user_id
        AND (mp.can_edit = true OR mp.is_owner = true)
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$function$;

-- Also fix the document_folders SELECT RLS policy to use has_role instead of user_roles directly
DROP POLICY IF EXISTS "Users can view accessible folders" ON public.document_folders;
CREATE POLICY "Users can view accessible folders"
  ON public.document_folders FOR SELECT TO authenticated
  USING (
    access_roles IS NULL
    OR has_folder_access(auth.uid(), id)
    OR has_role(auth.uid(), 'admin'::app_role)
  );