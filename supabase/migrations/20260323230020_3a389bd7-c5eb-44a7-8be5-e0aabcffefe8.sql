
-- Drop the old policy that allowed both owner and edit
DROP POLICY IF EXISTS "Module owners can view all orders" ON public.orders;

-- Recreate with only owner permission
CREATE POLICY "Module owners can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_module_slug_permission(auth.uid(), 'history', 'owner')
);

-- Add a function to check if a user can see subordinate orders
CREATE OR REPLACE FUNCTION public.is_subordinate_order(_viewer_id uuid, _requester_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles viewer_profile
    WHERE viewer_profile.user_id = _viewer_id
      AND has_role(_viewer_id, 'manager')
      AND EXISTS (
        SELECT 1 FROM get_subordinate_user_ids(viewer_profile.id) sub
        WHERE sub.user_id = _requester_id
      )
  )
$$;

-- Add RLS policy for managers to see subordinate orders
CREATE POLICY "Managers can view subordinate orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  is_subordinate_order(auth.uid(), requester_id)
);
