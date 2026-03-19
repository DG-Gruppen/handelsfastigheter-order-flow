
-- Shared passwords table
CREATE TABLE public.shared_passwords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL,
  username text NOT NULL DEFAULT '',
  password_value text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Junction table for group-based access
CREATE TABLE public.shared_password_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  password_id uuid NOT NULL REFERENCES public.shared_passwords(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  UNIQUE (password_id, group_id)
);

-- Enable RLS
ALTER TABLE public.shared_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_password_groups ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user has access to a shared password
CREATE OR REPLACE FUNCTION public.has_shared_password_access(_user_id uuid, _password_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_password_groups spg
    JOIN public.group_members gm ON gm.group_id = spg.group_id
    WHERE spg.password_id = _password_id
      AND gm.user_id = _user_id
  )
  -- If no groups assigned, no one except admin/IT sees it
$$;

-- RLS policies for shared_passwords
CREATE POLICY "Users can view passwords for their groups"
  ON public.shared_passwords FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'it'::app_role)
    OR has_shared_password_access(auth.uid(), id)
  );

CREATE POLICY "Admins and IT can insert passwords"
  ON public.shared_passwords FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'it'::app_role)
  );

CREATE POLICY "Admins and IT can update passwords"
  ON public.shared_passwords FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'it'::app_role)
  );

CREATE POLICY "Admins and IT can delete passwords"
  ON public.shared_passwords FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'it'::app_role)
  );

-- RLS policies for shared_password_groups
CREATE POLICY "Users can view password groups they belong to"
  ON public.shared_password_groups FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'it'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = shared_password_groups.group_id
        AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and IT can manage password groups"
  ON public.shared_password_groups FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'it'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'it'::app_role)
  );

-- Updated_at trigger
CREATE TRIGGER update_shared_passwords_updated_at
  BEFORE UPDATE ON public.shared_passwords
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
