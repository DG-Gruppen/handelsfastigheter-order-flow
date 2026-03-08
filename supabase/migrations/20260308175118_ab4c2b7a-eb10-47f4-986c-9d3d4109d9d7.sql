-- Departments table for managing available departments
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view departments" ON public.departments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage departments" ON public.departments
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Org chart settings table for storing color preferences
CREATE TABLE public.org_chart_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_chart_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view org settings" ON public.org_chart_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage org settings" ON public.org_chart_settings
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add title_override to profiles for custom titles
ALTER TABLE public.profiles ADD COLUMN title_override text DEFAULT NULL;

-- Seed existing departments from profiles
INSERT INTO public.departments (name)
SELECT DISTINCT department FROM public.profiles 
WHERE department IS NOT NULL AND department != ''
ON CONFLICT (name) DO NOTHING;

-- Seed default color settings
INSERT INTO public.org_chart_settings (setting_key, setting_value) VALUES
  ('color_root', 'primary'),
  ('color_staff', 'accent'),
  ('color_manager', 'blue,green,amber'),
  ('color_employee', 'muted')
ON CONFLICT (setting_key) DO NOTHING;