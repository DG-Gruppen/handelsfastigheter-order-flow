-- Create regions table
CREATE TABLE public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

-- Everyone can view regions
CREATE POLICY "Authenticated can view regions" ON public.regions
  FOR SELECT TO authenticated USING (true);

-- Only admins can manage regions
CREATE POLICY "Admins can manage regions" ON public.regions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add region_id to profiles
ALTER TABLE public.profiles ADD COLUMN region_id uuid REFERENCES public.regions(id);

-- Seed initial regions
INSERT INTO public.regions (name, sort_order) VALUES
  ('Norr', 1),
  ('Söder', 2),
  ('Mitt/Bromma', 3);
