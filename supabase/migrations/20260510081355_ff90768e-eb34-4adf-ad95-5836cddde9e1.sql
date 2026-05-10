
-- Uppdatera is_subordinate_order: byt has_role(_,'manager') → is_in_manager_group
CREATE OR REPLACE FUNCTION public.is_subordinate_order(_viewer_id uuid, _requester_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles viewer_profile
    WHERE viewer_profile.user_id = _viewer_id
      AND public.is_in_manager_group(_viewer_id)
      AND EXISTS (
        SELECT 1 FROM public.get_subordinate_user_ids(viewer_profile.id) sub
        WHERE sub.user_id = _requester_id
      )
  )
$$;

-- orders
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
CREATE POLICY "Admins can update all orders" ON public.orders
  FOR UPDATE TO authenticated USING (public.is_in_admin_group(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT TO authenticated USING (public.is_in_admin_group(auth.uid()));

-- order_items
DROP POLICY IF EXISTS "Admins can manage order items" ON public.order_items;
CREATE POLICY "Admins can manage order items" ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_in_admin_group(auth.uid()))
  WITH CHECK (public.is_in_admin_group(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
CREATE POLICY "Admins can view all order items" ON public.order_items
  FOR SELECT TO authenticated USING (public.is_in_admin_group(auth.uid()));

-- order_systems
DROP POLICY IF EXISTS "Admins can manage order systems" ON public.order_systems;
CREATE POLICY "Admins can manage order systems" ON public.order_systems
  FOR ALL TO authenticated
  USING (public.is_in_admin_group(auth.uid()))
  WITH CHECK (public.is_in_admin_group(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all order systems" ON public.order_systems;
CREATE POLICY "Admins can view all order systems" ON public.order_systems
  FOR SELECT TO authenticated USING (public.is_in_admin_group(auth.uid()));

-- order_types
DROP POLICY IF EXISTS "Admins can delete order types" ON public.order_types;
CREATE POLICY "Admins can delete order types" ON public.order_types
  FOR DELETE TO authenticated USING (public.is_in_admin_group(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert order types" ON public.order_types;
CREATE POLICY "Admins can insert order types" ON public.order_types
  FOR INSERT TO authenticated WITH CHECK (public.is_in_admin_group(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage order types" ON public.order_types;
CREATE POLICY "Admins can manage order types" ON public.order_types
  FOR ALL TO authenticated
  USING (public.is_in_admin_group(auth.uid()))
  WITH CHECK (public.is_in_admin_group(auth.uid()));

DROP POLICY IF EXISTS "Admins can update order types" ON public.order_types;
CREATE POLICY "Admins can update order types" ON public.order_types
  FOR UPDATE TO authenticated USING (public.is_in_admin_group(auth.uid()));

-- order_type_departments
DROP POLICY IF EXISTS "Admins can manage order_type_departments" ON public.order_type_departments;
CREATE POLICY "Admins can manage order_type_departments" ON public.order_type_departments
  FOR ALL TO authenticated
  USING (public.is_in_admin_group(auth.uid()))
  WITH CHECK (public.is_in_admin_group(auth.uid()));
