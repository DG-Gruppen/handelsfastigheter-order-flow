
-- Multi-owner support for tools
CREATE TABLE public.tool_owners (
  tool_id uuid NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tool_id, profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_owners TO authenticated;
GRANT ALL ON public.tool_owners TO service_role;

ALTER TABLE public.tool_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read tool_owners"
  ON public.tool_owners FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/IT can manage tool_owners"
  ON public.tool_owners FOR ALL TO authenticated
  USING (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'it'::app_role))
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'it'::app_role));

-- Backfill existing single owners into the junction table
INSERT INTO public.tool_owners (tool_id, profile_id)
SELECT id, owner_id FROM public.tools WHERE owner_id IS NOT NULL
ON CONFLICT DO NOTHING;
