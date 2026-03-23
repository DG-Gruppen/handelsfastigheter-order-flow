CREATE POLICY "Module owners can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_module_slug_permission(auth.uid(), 'history', 'owner')
  OR has_module_slug_permission(auth.uid(), 'history', 'edit')
);