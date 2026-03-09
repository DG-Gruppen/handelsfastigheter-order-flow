
-- Junction table: which departments can see a category
CREATE TABLE public.category_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  UNIQUE(category_id, department_id)
);

ALTER TABLE public.category_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage category_departments"
  ON public.category_departments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view category_departments"
  ON public.category_departments FOR SELECT
  USING (true);

-- Junction table: which departments can see an order type
CREATE TABLE public.order_type_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_type_id uuid NOT NULL REFERENCES public.order_types(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  UNIQUE(order_type_id, department_id)
);

ALTER TABLE public.order_type_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage order_type_departments"
  ON public.order_type_departments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view order_type_departments"
  ON public.order_type_departments FOR SELECT
  USING (true);
