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
  -- No restrictions = everyone can see
  IF _roles IS NULL THEN RETURN true; END IF;
  -- Check role-based access via has_role (supports groups)
  IF EXISTS (
    SELECT 1 FROM unnest(_roles) AS r(role_name)
    WHERE public.has_role(_user_id, r.role_name::app_role)
  ) THEN
    RETURN true;
  END IF;
  -- Owners of the documents module always have access
  IF public.has_module_slug_permission(_user_id, 'documents', 'owner') THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$function$;