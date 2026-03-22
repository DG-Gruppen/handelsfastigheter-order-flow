CREATE OR REPLACE FUNCTION public.get_all_user_roles()
 RETURNS TABLE(user_id uuid, role app_role)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only admins can enumerate all roles
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  
  RETURN QUERY SELECT ur.user_id, ur.role FROM public.user_roles ur;
END;
$function$;