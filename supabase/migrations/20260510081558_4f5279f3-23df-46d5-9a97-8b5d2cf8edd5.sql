
-- categories
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;
CREATE POLICY "Admins can delete categories" ON public.categories
  FOR DELETE TO authenticated USING (public.is_in_admin_group(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
CREATE POLICY "Admins can insert categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (public.is_in_admin_group(auth.uid()));

DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
CREATE POLICY "Admins can update categories" ON public.categories
  FOR UPDATE TO authenticated USING (public.is_in_admin_group(auth.uid()));

-- departments
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
CREATE POLICY "Admins can manage departments" ON public.departments
  FOR ALL TO authenticated
  USING (public.is_in_admin_group(auth.uid()))
  WITH CHECK (public.is_in_admin_group(auth.uid()));

-- category_departments
DROP POLICY IF EXISTS "Admins can manage category_departments" ON public.category_departments;
CREATE POLICY "Admins can manage category_departments" ON public.category_departments
  FOR ALL TO authenticated
  USING (public.is_in_admin_group(auth.uid()))
  WITH CHECK (public.is_in_admin_group(auth.uid()));
