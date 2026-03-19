
-- Update shared_passwords SELECT policy: all authenticated users with module access can view
DROP POLICY IF EXISTS "Users can view passwords for their groups" ON public.shared_passwords;
CREATE POLICY "Authenticated users can view passwords"
  ON public.shared_passwords FOR SELECT TO authenticated
  USING (true);

-- Update shared_password_groups SELECT policy: all authenticated can view
DROP POLICY IF EXISTS "Users can view password groups they belong to" ON public.shared_password_groups;
CREATE POLICY "Authenticated users can view password groups"
  ON public.shared_password_groups FOR SELECT TO authenticated
  USING (true);
