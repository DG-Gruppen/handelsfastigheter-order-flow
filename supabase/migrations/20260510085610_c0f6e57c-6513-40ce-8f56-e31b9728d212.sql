
-- external_invites
DROP POLICY IF EXISTS "Admins can manage external invites" ON public.external_invites;
CREATE POLICY "Admins can manage external invites" ON public.external_invites
  FOR ALL TO authenticated
  USING (is_in_admin_group(auth.uid()))
  WITH CHECK (is_in_admin_group(auth.uid()));

-- modules
DROP POLICY IF EXISTS "Admins can manage modules" ON public.modules;
CREATE POLICY "Admins can manage modules" ON public.modules
  FOR ALL TO authenticated
  USING (is_in_admin_group(auth.uid()))
  WITH CHECK (is_in_admin_group(auth.uid()));

-- module_role_access
DROP POLICY IF EXISTS "Admins can manage module access" ON public.module_role_access;
CREATE POLICY "Admins can manage module access" ON public.module_role_access
  FOR ALL TO authenticated
  USING (is_in_admin_group(auth.uid()))
  WITH CHECK (is_in_admin_group(auth.uid()));

-- module_permissions
DROP POLICY IF EXISTS "Admins and owners can manage permissions" ON public.module_permissions;
CREATE POLICY "Admins and owners can manage permissions" ON public.module_permissions
  FOR ALL TO authenticated
  USING (is_in_admin_group(auth.uid()) OR has_module_permission(auth.uid(), module_id, 'owner'::text))
  WITH CHECK (is_in_admin_group(auth.uid()) OR has_module_permission(auth.uid(), module_id, 'owner'::text));

-- module_activity_log
DROP POLICY IF EXISTS "Admins and owners can view activity" ON public.module_activity_log;
CREATE POLICY "Admins and owners can view activity" ON public.module_activity_log
  FOR SELECT TO authenticated
  USING (is_in_admin_group(auth.uid()) OR has_module_permission(auth.uid(), module_id, 'owner'::text));
