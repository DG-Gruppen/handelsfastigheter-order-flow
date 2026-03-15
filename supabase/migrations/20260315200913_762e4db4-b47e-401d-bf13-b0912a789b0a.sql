
-- Modules registry
CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  route text NOT NULL,
  icon text NOT NULL DEFAULT 'layout-grid',
  description text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active modules"
  ON public.modules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage modules"
  ON public.modules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Module role access
CREATE TABLE public.module_role_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  has_access boolean NOT NULL DEFAULT true,
  UNIQUE(module_id, role)
);

ALTER TABLE public.module_role_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view module access"
  ON public.module_role_access FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage module access"
  ON public.module_role_access FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed existing modules
INSERT INTO public.modules (name, slug, route, icon, sort_order, description) VALUES
  ('Hem', 'home', '/dashboard', 'home', 0, 'Startsida och översikt'),
  ('Ny beställning', 'new-order', '/orders/new', 'plus', 1, 'Skapa en ny utrustningsbeställning'),
  ('On-/Offboarding', 'onboarding', '/onboarding', 'user-plus', 2, 'Hantera nyanställda och avslut'),
  ('Historik', 'history', '/history', 'history', 3, 'Se tidigare beställningar'),
  ('IT-support', 'it-support', '/it-info', 'headphones', 4, 'FAQ och supportinformation'),
  ('Organisation', 'org', '/org', 'building-2', 5, 'Organisationsschema'),
  ('Admin', 'admin', '/admin', 'settings', 6, 'Systemadministration'),
  ('Strategi & Mål', 'strategy', '/strategi', 'target', 10, 'OKR:er och företagsmål'),
  ('Nyheter', 'news', '/nyheter', 'newspaper', 11, 'Nyheter via Cision'),
  ('Fastigheter', 'properties', '/fastigheter', 'building', 12, 'Fastighetsöversikt'),
  ('Personal', 'personnel', '/personal', 'users', 13, 'Medarbetarkatalog'),
  ('Dokument', 'documents', '/dokument', 'folder-open', 14, 'Policys och mallar'),
  ('Kunskapsbanken', 'knowledge', '/kunskapsbanken', 'book-open', 15, 'Wiki och utbildningar'),
  ('Kulturen', 'culture', '/kulturen', 'heart', 16, 'Erkännanden och kultur'),
  ('Pulsmätning', 'pulse', '/pulsmatning', 'bar-chart-3', 17, 'Anonym medarbetarenkät'),
  ('Mitt SHF', 'my-shf', '/mitt-shf', 'user', 18, 'Personlig sida'),
  ('Verktyg', 'tools', '/verktyg', 'layout-grid', 19, 'Snabblänkar till system'),
  ('IT-portalen', 'it-portal', '/it-portalen', 'monitor', 20, 'Extern IT-portal');

-- Default access: all roles get access to home
INSERT INTO public.module_role_access (module_id, role, has_access)
SELECT m.id, r.role, 
  CASE 
    WHEN m.slug = 'admin' AND r.role NOT IN ('admin') THEN false
    WHEN m.slug = 'org' AND r.role NOT IN ('admin') THEN false
    WHEN m.slug = 'onboarding' AND r.role NOT IN ('admin', 'manager') THEN false
    WHEN m.slug IN ('strategy', 'news', 'properties', 'personnel', 'documents', 'knowledge', 'culture', 'pulse', 'my-shf', 'tools', 'it-portal') THEN false
    ELSE true
  END
FROM public.modules m
CROSS JOIN (VALUES ('admin'::app_role), ('manager'::app_role), ('employee'::app_role), ('staff'::app_role), ('it'::app_role)) AS r(role);
