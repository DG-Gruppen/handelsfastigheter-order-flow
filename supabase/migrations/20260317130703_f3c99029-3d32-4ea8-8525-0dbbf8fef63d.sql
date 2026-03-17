
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

  -- If write_roles is set, check role-based access
  IF _write_roles IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role::text = ANY(_write_roles)
    ) THEN
      RETURN true;
    END IF;
  END IF;

  -- Check module-level edit/owner permission on the documents module
  SELECT id INTO _doc_module_id FROM public.modules WHERE slug = 'documents' LIMIT 1;
  IF _doc_module_id IS NOT NULL THEN
    -- Direct user permission
    IF EXISTS (
      SELECT 1 FROM public.module_permissions mp
      WHERE mp.module_id = _doc_module_id
        AND mp.grantee_type = 'user'
        AND mp.grantee_id = _user_id
        AND (mp.can_edit = true OR mp.is_owner = true)
    ) THEN
      RETURN true;
    END IF;

    -- Group-based permission
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
