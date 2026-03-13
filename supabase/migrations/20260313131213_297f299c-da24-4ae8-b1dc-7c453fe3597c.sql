
-- Systems/licenses that can be assigned during onboarding
CREATE TABLE public.systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  icon text DEFAULT 'monitor',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view systems" ON public.systems
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage systems" ON public.systems
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Junction: which systems were selected for an order
CREATE TABLE public.order_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own order systems" ON public.order_systems
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders WHERE orders.id = order_systems.order_id AND orders.requester_id = auth.uid()
  ));

CREATE POLICY "Users can view own order systems" ON public.order_systems
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders WHERE orders.id = order_systems.order_id
    AND (orders.requester_id = auth.uid() OR orders.approver_id = auth.uid())
  ));

CREATE POLICY "Admins can view all order systems" ON public.order_systems
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage order systems" ON public.order_systems
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed some common systems
INSERT INTO public.systems (name, description, icon, sort_order) VALUES
  ('Microsoft 365', 'E-post, Teams, Office-paketet', 'mail', 1),
  ('Google Workspace', 'Gmail, Drive, Calendar', 'chrome', 2),
  ('Adobe Creative Cloud', 'Photoshop, Illustrator m.m.', 'palette', 3),
  ('VPN-åtkomst', 'Fjärranslutning till företagsnätverket', 'shield', 4),
  ('Ekonomisystem', 'Tillgång till ekonomi- och faktureringssystem', 'calculator', 5),
  ('Intranät', 'Tillgång till företagets intranät', 'globe', 6),
  ('Telefoni', 'Fast eller mobil företagstelefoni', 'phone', 7),
  ('Projekthantering', 'Jira, Asana eller liknande', 'kanban', 8);
