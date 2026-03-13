
-- Allow managers and admins to insert profiles (for onboarding new employees)
CREATE POLICY "Managers and admins can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
);
