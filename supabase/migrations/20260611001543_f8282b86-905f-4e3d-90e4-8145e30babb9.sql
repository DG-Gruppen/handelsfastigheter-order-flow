
-- 1) External contacts
CREATE TABLE public.external_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text,
  full_name text NOT NULL,
  email text,
  phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_contacts TO authenticated;
GRANT ALL ON public.external_contacts TO service_role;

ALTER TABLE public.external_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view external contacts"
  ON public.external_contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert external contacts"
  ON public.external_contacts FOR INSERT TO authenticated
  WITH CHECK (
    public.is_in_admin_group(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'it'::app_role)
  );

CREATE POLICY "Admins can update external contacts"
  ON public.external_contacts FOR UPDATE TO authenticated
  USING (
    public.is_in_admin_group(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'it'::app_role)
  )
  WITH CHECK (
    public.is_in_admin_group(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'it'::app_role)
  );

CREATE POLICY "Admins can delete external contacts"
  ON public.external_contacts FOR DELETE TO authenticated
  USING (
    public.is_in_admin_group(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'it'::app_role)
  );

CREATE TRIGGER trg_external_contacts_updated_at
  BEFORE UPDATE ON public.external_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Restructure tool_owners
ALTER TABLE public.tool_owners DROP CONSTRAINT IF EXISTS tool_owners_pkey;

ALTER TABLE public.tool_owners
  ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid();

ALTER TABLE public.tool_owners
  ADD COLUMN external_contact_id uuid REFERENCES public.external_contacts(id) ON DELETE CASCADE;

ALTER TABLE public.tool_owners
  ALTER COLUMN profile_id DROP NOT NULL;

ALTER TABLE public.tool_owners
  ADD CONSTRAINT tool_owners_exactly_one_owner CHECK (
    (profile_id IS NOT NULL AND external_contact_id IS NULL)
    OR (profile_id IS NULL AND external_contact_id IS NOT NULL)
  );

CREATE UNIQUE INDEX tool_owners_tool_profile_uniq
  ON public.tool_owners(tool_id, profile_id)
  WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX tool_owners_tool_external_uniq
  ON public.tool_owners(tool_id, external_contact_id)
  WHERE external_contact_id IS NOT NULL;

-- 3) tools.owner_id nullable
ALTER TABLE public.tools
  ALTER COLUMN owner_id DROP NOT NULL;
