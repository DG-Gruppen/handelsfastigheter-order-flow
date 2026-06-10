
-- Add owner to tools, plus tool/department junction
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;

UPDATE public.tools SET owner_id = 'c32ae9d4-87c8-4cd8-9099-3bcc1560c4cf' WHERE owner_id IS NULL;

ALTER TABLE public.tools ALTER COLUMN owner_id SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.tool_departments (
  tool_id uuid NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tool_id, department_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_departments TO authenticated;
GRANT ALL ON public.tool_departments TO service_role;

ALTER TABLE public.tool_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tool departments"
  ON public.tool_departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors can manage tool departments"
  ON public.tool_departments FOR ALL TO authenticated
  USING (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'tools', 'edit'))
  WITH CHECK (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'tools', 'edit'));
