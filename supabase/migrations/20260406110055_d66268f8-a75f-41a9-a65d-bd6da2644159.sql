
-- Create anonymous page analytics table
CREATE TABLE public.page_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_path text NOT NULL,
  module_slug text,
  session_hash text NOT NULL,
  duration_seconds integer DEFAULT 0,
  referrer_path text,
  viewport_width integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.page_analytics ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert (anonymous tracking)
CREATE POLICY "Authenticated can log page views"
ON public.page_analytics
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only admin/IT can read analytics
CREATE POLICY "Admin and IT can view analytics"
ON public.page_analytics
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'it'::app_role)
);

-- Only admin can delete (cleanup)
CREATE POLICY "Admin can delete analytics"
ON public.page_analytics
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for fast aggregation
CREATE INDEX idx_page_analytics_path ON public.page_analytics (page_path);
CREATE INDEX idx_page_analytics_created ON public.page_analytics (created_at DESC);
CREATE INDEX idx_page_analytics_module ON public.page_analytics (module_slug) WHERE module_slug IS NOT NULL;
CREATE INDEX idx_page_analytics_session ON public.page_analytics (session_hash);

-- Register the module
INSERT INTO public.modules (name, slug, icon, route, description, sort_order, is_active)
VALUES ('Statistik', 'statistik', 'bar-chart-3', '/statistik', 'Anonym besöksstatistik för moduler och sidor', 50, true);
