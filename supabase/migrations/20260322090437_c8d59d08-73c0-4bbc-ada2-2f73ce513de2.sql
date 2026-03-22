DROP POLICY IF EXISTS "Authenticated users can view passwords" ON public.shared_passwords;

CREATE POLICY "Users can only view group-accessible passwords"
ON public.shared_passwords FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'it'::app_role) OR
  public.has_module_slug_permission(auth.uid(), 'losenord'::text, 'edit'::text) OR
  public.has_shared_password_access(auth.uid(), id)
);