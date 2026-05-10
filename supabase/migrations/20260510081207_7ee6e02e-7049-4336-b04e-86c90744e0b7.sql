
-- =============================================
-- FAS 1: Additiv — gruppflaggor + nya hjälpfunktioner
-- Inget anropas ännu; befintligt has_role() oförändrat
-- =============================================

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS is_admin_group   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_it_group      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_manager_group boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_staff_group   boolean NOT NULL DEFAULT false;

-- Migrera utifrån dagens role_equivalent
UPDATE public.groups SET is_admin_group   = true WHERE role_equivalent = 'admin';
UPDATE public.groups SET is_it_group      = true WHERE role_equivalent = 'it';
UPDATE public.groups SET is_manager_group = true WHERE role_equivalent = 'manager';
UPDATE public.groups SET is_staff_group   = true WHERE role_equivalent = 'staff';

-- Underchefer — regionschefer = manager-nivå
UPDATE public.groups SET is_manager_group = true WHERE name = 'Underchefer';

-- Säkerställ Superadmin
UPDATE public.groups SET is_admin_group = true WHERE name = 'Superadmin';

-- =============================================
-- Nya security definer-funktioner
-- =============================================

CREATE OR REPLACE FUNCTION public.is_in_admin_group(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = _user_id AND g.is_admin_group = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_in_it_group(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = _user_id AND g.is_it_group = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_in_manager_group(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = _user_id AND g.is_manager_group = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_in_staff_group(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = _user_id AND g.is_staff_group = true
  )
$$;

-- Generisk: medlemskap i grupp via namn
CREATE OR REPLACE FUNCTION public.user_in_group_named(_user_id uuid, _group_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = _user_id AND g.name = _group_name
  )
$$;
