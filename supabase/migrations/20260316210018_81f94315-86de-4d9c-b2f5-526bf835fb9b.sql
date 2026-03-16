
CREATE OR REPLACE FUNCTION public.get_subordinate_user_ids(_manager_profile_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE subordinates AS (
    -- Direct reports
    SELECT p.user_id, p.id AS profile_id
    FROM public.profiles p
    WHERE p.manager_id = _manager_profile_id

    UNION ALL

    -- Recursive: reports of reports
    SELECT p.user_id, p.id AS profile_id
    FROM public.profiles p
    INNER JOIN subordinates s ON p.manager_id = s.profile_id
  )
  SELECT s.user_id FROM subordinates s;
$$;
