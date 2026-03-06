
-- Allow admins to delete order types
CREATE POLICY "Admins can delete order types" ON public.order_types FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update order types  
CREATE POLICY "Admins can update order types" ON public.order_types FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to insert order types
CREATE POLICY "Admins can insert order types" ON public.order_types FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
