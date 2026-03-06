
-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'package',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update categories" ON public.categories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete categories" ON public.categories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed with existing categories
INSERT INTO public.categories (name, icon, sort_order) VALUES
  ('Datorer', 'laptop', 1),
  ('Telefoner', 'smartphone', 2),
  ('Kringutrustning', 'monitor', 3),
  ('Övrigt', 'package', 4);

-- Add category_id column to order_types (replacing enum)
ALTER TABLE public.order_types ADD COLUMN category_id UUID REFERENCES public.categories(id);

-- Populate category_id from existing enum values
UPDATE public.order_types SET category_id = (SELECT id FROM public.categories WHERE name = 'Datorer') WHERE category = 'computer';
UPDATE public.order_types SET category_id = (SELECT id FROM public.categories WHERE name = 'Telefoner') WHERE category = 'phone';
UPDATE public.order_types SET category_id = (SELECT id FROM public.categories WHERE name = 'Kringutrustning') WHERE category = 'peripheral';
UPDATE public.order_types SET category_id = (SELECT id FROM public.categories WHERE name = 'Övrigt') WHERE category = 'other';

-- Add category_id to orders table too
ALTER TABLE public.orders ADD COLUMN category_id UUID REFERENCES public.categories(id);

UPDATE public.orders SET category_id = (SELECT id FROM public.categories WHERE name = 'Datorer') WHERE category = 'computer';
UPDATE public.orders SET category_id = (SELECT id FROM public.categories WHERE name = 'Telefoner') WHERE category = 'phone';
UPDATE public.orders SET category_id = (SELECT id FROM public.categories WHERE name = 'Kringutrustning') WHERE category = 'peripheral';
UPDATE public.orders SET category_id = (SELECT id FROM public.categories WHERE name = 'Övrigt') WHERE category = 'other';
