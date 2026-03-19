
-- Drop old restrictive policies
DROP POLICY "Admins and IT can insert passwords" ON public.shared_passwords;
DROP POLICY "Admins and IT can update passwords" ON public.shared_passwords;
DROP POLICY "Admins and IT can delete passwords" ON public.shared_passwords;

-- Create new policies that also check module permissions
CREATE POLICY "Editors can insert passwords" ON public.shared_passwords
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'it'::app_role)
    OR has_module_slug_permission(auth.uid(), 'losenord'::text, 'edit'::text)
  );

CREATE POLICY "Editors can update passwords" ON public.shared_passwords
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'it'::app_role)
    OR has_module_slug_permission(auth.uid(), 'losenord'::text, 'edit'::text)
  );

CREATE POLICY "Editors can delete passwords" ON public.shared_passwords
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'it'::app_role)
    OR has_module_slug_permission(auth.uid(), 'losenord'::text, 'edit'::text)
  );
