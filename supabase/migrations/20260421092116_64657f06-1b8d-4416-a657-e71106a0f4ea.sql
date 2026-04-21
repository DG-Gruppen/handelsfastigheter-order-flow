-- 1. KPI module
INSERT INTO public.modules (slug, name, route, icon, description, sort_order, is_active)
VALUES ('kpi', 'KPI', '/kpi', 'trending-up', 'Budget vs utfall per region', 50, true)
ON CONFLICT (slug) DO NOTHING;

-- 2. KPI types enum (as text for flexibility)
CREATE TABLE IF NOT EXISTS public.kpi_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'mkr',
  format text NOT NULL DEFAULT 'currency',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  higher_is_better boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kpi_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view kpi_types" ON public.kpi_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors can manage kpi_types" ON public.kpi_types
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'kpi', 'edit'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'kpi', 'edit'));

-- Seed standard KPI types
INSERT INTO public.kpi_types (slug, name, unit, format, sort_order, higher_is_better) VALUES
  ('driftnetto', 'Driftnetto', 'mkr', 'currency', 1, true),
  ('hyresintakter', 'Hyresintäkter', 'mkr', 'currency', 2, true),
  ('vakansgrad', 'Vakansgrad', '%', 'percent', 3, false),
  ('fastighetsvarde', 'Fastighetsvärde', 'mdr', 'currency_bn', 4, true)
ON CONFLICT (slug) DO NOTHING;

-- 3. KPI data
CREATE TABLE IF NOT EXISTS public.kpi_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  quarter integer NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  region_id uuid REFERENCES public.regions(id) ON DELETE CASCADE,
  region_name text,
  kpi_type_id uuid NOT NULL REFERENCES public.kpi_types(id) ON DELETE CASCADE,
  budget numeric,
  actual numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (year, quarter, region_id, kpi_type_id)
);

CREATE INDEX IF NOT EXISTS idx_kpi_data_period ON public.kpi_data(year, quarter);
CREATE INDEX IF NOT EXISTS idx_kpi_data_region ON public.kpi_data(region_id);

ALTER TABLE public.kpi_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with view access can view kpi_data" ON public.kpi_data
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_module_slug_permission(auth.uid(), 'kpi', 'view')
    OR has_module_slug_permission(auth.uid(), 'kpi', 'edit')
    OR has_module_slug_permission(auth.uid(), 'kpi', 'owner')
  );

CREATE POLICY "Editors can insert kpi_data" ON public.kpi_data
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'kpi', 'edit'));

CREATE POLICY "Editors can update kpi_data" ON public.kpi_data
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'kpi', 'edit'));

CREATE POLICY "Editors can delete kpi_data" ON public.kpi_data
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'kpi', 'delete'));

CREATE TRIGGER update_kpi_data_updated_at
  BEFORE UPDATE ON public.kpi_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Storage bucket for KPI excel uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('kpi-uploads', 'kpi-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Editors can upload kpi files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kpi-uploads'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'kpi', 'edit'))
  );

CREATE POLICY "Editors can view kpi files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kpi-uploads'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'kpi', 'edit'))
  );