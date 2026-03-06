
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_type_id uuid REFERENCES public.order_types(id),
  category_id uuid REFERENCES public.categories(id),
  name text NOT NULL,
  description text DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Users can insert items for their own orders
CREATE POLICY "Users can insert own order items"
ON public.order_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.requester_id = auth.uid())
);

-- Users can view items of orders they can see
CREATE POLICY "Users can view own order items"
ON public.order_items FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND (orders.requester_id = auth.uid() OR orders.approver_id = auth.uid()))
);

-- Admins can view all
CREATE POLICY "Admins can view all order items"
ON public.order_items FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Admins can manage all
CREATE POLICY "Admins can manage order items"
ON public.order_items FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'));
