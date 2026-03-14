
-- Create a function to get managers (users with manager role) - needed by order forms
CREATE OR REPLACE FUNCTION public.get_manager_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'manager'::app_role;
$$;

-- Create a function to get all roles for org chart display (returns user_id + role)
CREATE OR REPLACE FUNCTION public.get_all_user_roles()
RETURNS TABLE(user_id uuid, role app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id, ur.role FROM public.user_roles ur;
$$;
