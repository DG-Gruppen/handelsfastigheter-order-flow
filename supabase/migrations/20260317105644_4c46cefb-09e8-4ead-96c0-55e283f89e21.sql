
-- Create ALL tables first
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text DEFAULT '',
  color text,
  is_system boolean DEFAULT false,
  role_equivalent public.app_role,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE public.module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
  grantee_type text NOT NULL DEFAULT 'group' CHECK (grantee_type IN ('user', 'group')),
  grantee_id uuid NOT NULL,
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  is_owner boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(module_id, grantee_type, grantee_id)
);

CREATE TABLE public.module_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  entity_name text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_activity_log ENABLE ROW LEVEL SECURITY;

-- Functions
CREATE OR REPLACE FUNCTION public.has_module_permission(
  _user_id uuid, _module_id uuid, _permission text
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.module_permissions mp
    WHERE mp.module_id = _module_id AND mp.grantee_type = 'user' AND mp.grantee_id = _user_id
      AND CASE _permission WHEN 'view' THEN mp.can_view WHEN 'edit' THEN mp.can_edit
        WHEN 'delete' THEN mp.can_delete WHEN 'owner' THEN mp.is_owner ELSE false END
  ) OR EXISTS (
    SELECT 1 FROM public.module_permissions mp
    JOIN public.group_members gm ON gm.group_id = mp.grantee_id
    WHERE mp.module_id = _module_id AND mp.grantee_type = 'group' AND gm.user_id = _user_id
      AND CASE _permission WHEN 'view' THEN mp.can_view WHEN 'edit' THEN mp.can_edit
        WHEN 'delete' THEN mp.can_delete WHEN 'owner' THEN mp.is_owner ELSE false END
  )
$$;

-- RLS policies
CREATE POLICY "Authenticated can view groups" ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage groups" ON public.groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view group members" ON public.group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage group members" ON public.group_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view module permissions" ON public.module_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and owners can manage permissions" ON public.module_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_module_permission(auth.uid(), module_id, 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_module_permission(auth.uid(), module_id, 'owner'));

CREATE POLICY "Admins and owners can view activity" ON public.module_activity_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_module_permission(auth.uid(), module_id, 'owner'));
CREATE POLICY "Users can log activity" ON public.module_activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Seed system groups
INSERT INTO public.groups (name, description, color, is_system, role_equivalent) VALUES
  ('Anställda', 'Alla anställda i organisationen', '#22c55e', true, 'employee'),
  ('Chefer', 'Personal med chefsansvar', '#f59e0b', true, 'manager'),
  ('Administratörer', 'Systemadministratörer med full åtkomst', '#ef4444', true, 'admin'),
  ('Stab', 'Stabsmedarbetare', '#8b5cf6', true, 'staff'),
  ('IT', 'IT-avdelningen', '#3b82f6', true, 'it');

-- Migrate user_roles → group_members
INSERT INTO public.group_members (group_id, user_id)
SELECT g.id, ur.user_id FROM public.user_roles ur
JOIN public.groups g ON g.role_equivalent = ur.role
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Migrate module_role_access → module_permissions
INSERT INTO public.module_permissions (module_id, grantee_type, grantee_id, can_view, can_edit, can_delete, is_owner)
SELECT DISTINCT ON (mra.module_id, g.id) mra.module_id, 'group', g.id, mra.has_access, false, false, false
FROM public.module_role_access mra
JOIN public.groups g ON g.role_equivalent = mra.role
ON CONFLICT (module_id, grantee_type, grantee_id) DO NOTHING;

-- Update has_role() to also check groups
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  ) OR EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = _user_id AND g.role_equivalent = _role
  )
$$;
