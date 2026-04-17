DROP POLICY IF EXISTS "Users can only view group-accessible passwords" ON public.shared_passwords;
DROP POLICY IF EXISTS "Users can view passwords for their groups" ON public.shared_passwords;

CREATE POLICY "Users with module access can view all passwords"
  ON public.shared_passwords
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'it'::app_role)
    OR has_module_slug_permission(auth.uid(), 'losenord'::text, 'view'::text)
    OR has_module_slug_permission(auth.uid(), 'losenord'::text, 'edit'::text)
    OR has_shared_password_access(auth.uid(), id)
  );