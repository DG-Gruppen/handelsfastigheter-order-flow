
-- Step 1: Update has_module_permission so is_owner implicitly grants view/edit/delete
CREATE OR REPLACE FUNCTION public.has_module_permission(_user_id uuid, _module_id uuid, _permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.module_permissions mp
    WHERE mp.module_id = _module_id AND mp.grantee_type = 'user' AND mp.grantee_id = _user_id
      AND CASE _permission
        WHEN 'view'   THEN (mp.can_view   OR mp.is_owner)
        WHEN 'edit'   THEN (mp.can_edit   OR mp.is_owner)
        WHEN 'delete' THEN (mp.can_delete OR mp.is_owner)
        WHEN 'owner'  THEN mp.is_owner
        ELSE false END
  ) OR EXISTS (
    SELECT 1 FROM public.module_permissions mp
    JOIN public.group_members gm ON gm.group_id = mp.grantee_id
    WHERE mp.module_id = _module_id AND mp.grantee_type = 'group' AND gm.user_id = _user_id
      AND CASE _permission
        WHEN 'view'   THEN (mp.can_view   OR mp.is_owner)
        WHEN 'edit'   THEN (mp.can_edit   OR mp.is_owner)
        WHEN 'delete' THEN (mp.can_delete OR mp.is_owner)
        WHEN 'owner'  THEN mp.is_owner
        ELSE false END
  )
$function$;

-- Step 1b: Same fix for slug-based version
CREATE OR REPLACE FUNCTION public.has_module_slug_permission(_user_id uuid, _slug text, _permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.module_permissions mp
    JOIN public.modules m ON m.id = mp.module_id
    WHERE m.slug = _slug AND mp.grantee_type = 'user' AND mp.grantee_id = _user_id
      AND CASE _permission
        WHEN 'view'   THEN (mp.can_view   OR mp.is_owner)
        WHEN 'edit'   THEN (mp.can_edit   OR mp.is_owner)
        WHEN 'delete' THEN (mp.can_delete OR mp.is_owner)
        WHEN 'owner'  THEN mp.is_owner
        ELSE false END
  ) OR EXISTS (
    SELECT 1 FROM public.module_permissions mp
    JOIN public.modules m ON m.id = mp.module_id
    JOIN public.group_members gm ON gm.group_id = mp.grantee_id
    WHERE m.slug = _slug AND mp.grantee_type = 'group' AND gm.user_id = _user_id
      AND CASE _permission
        WHEN 'view'   THEN (mp.can_view   OR mp.is_owner)
        WHEN 'edit'   THEN (mp.can_edit   OR mp.is_owner)
        WHEN 'delete' THEN (mp.can_delete OR mp.is_owner)
        WHEN 'owner'  THEN mp.is_owner
        ELSE false END
  )
$function$;

-- Step 2: Trigger to auto-normalize permission rows on insert/update
CREATE OR REPLACE FUNCTION public.normalize_module_permissions()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Owner implies everything
  IF NEW.is_owner THEN
    NEW.can_view := true;
    NEW.can_edit := true;
    NEW.can_delete := true;
  END IF;
  -- Delete implies edit
  IF NEW.can_delete THEN
    NEW.can_edit := true;
  END IF;
  -- Edit implies view
  IF NEW.can_edit THEN
    NEW.can_view := true;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS normalize_module_permissions_trg ON public.module_permissions;
CREATE TRIGGER normalize_module_permissions_trg
  BEFORE INSERT OR UPDATE ON public.module_permissions
  FOR EACH ROW EXECUTE FUNCTION public.normalize_module_permissions();

-- Step 2b: One-time cleanup of existing rows
UPDATE public.module_permissions SET can_view = true
  WHERE can_view = false AND (can_edit OR can_delete OR is_owner);
UPDATE public.module_permissions SET can_edit = true
  WHERE can_edit = false AND (can_delete OR is_owner);
UPDATE public.module_permissions SET can_delete = true
  WHERE can_delete = false AND is_owner;

-- Step 3: Remove rows with all flags false (dead permissions)
DELETE FROM public.module_permissions
  WHERE NOT can_view AND NOT can_edit AND NOT can_delete AND NOT is_owner;
