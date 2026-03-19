
CREATE TABLE public.workwear_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'submitted',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workwear_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workwear orders"
  ON public.workwear_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workwear orders"
  ON public.workwear_orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all workwear orders"
  ON public.workwear_orders FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update workwear orders"
  ON public.workwear_orders FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
