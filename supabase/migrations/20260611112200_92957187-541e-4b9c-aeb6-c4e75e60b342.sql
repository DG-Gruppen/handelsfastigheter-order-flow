
-- ============================================================
-- Agent A: Onboarding & Offboarding grundschema
-- ============================================================

-- Enums
CREATE TYPE public.onboarding_kind AS ENUM ('onboarding', 'offboarding');
CREATE TYPE public.onboarding_assignee_source AS ENUM ('static_profile', 'tool_owner', 'area_owner', 'role', 'nearest_manager');
CREATE TYPE public.onboarding_instance_status AS ENUM ('draft', 'pending_hr', 'active', 'completed', 'cancelled');
CREATE TYPE public.onboarding_task_status AS ENUM ('pending', 'done', 'not_applicable');

-- ============================================================
-- RLS helper: HR-grupp (matchar gruppnamn som innehåller "hr")
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_in_hr_group(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = _user_id
      AND (lower(g.name) LIKE '%hr%' OR lower(g.name) LIKE '%personal%')
  );
$$;

-- ============================================================
-- responsibility_areas
-- ============================================================
CREATE TABLE public.responsibility_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsibility_areas TO authenticated;
GRANT ALL ON public.responsibility_areas TO service_role;

ALTER TABLE public.responsibility_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan lasa ansvarsomraden"
  ON public.responsibility_areas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin eller HR kan hantera ansvarsomraden"
  ON public.responsibility_areas FOR ALL TO authenticated
  USING (public.is_in_admin_group(auth.uid()) OR public.is_in_hr_group(auth.uid()))
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR public.is_in_hr_group(auth.uid()));

CREATE TRIGGER trg_responsibility_areas_updated_at
  BEFORE UPDATE ON public.responsibility_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- responsibility_owners
-- ============================================================
CREATE TABLE public.responsibility_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES public.responsibility_areas(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (area_id, profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsibility_owners TO authenticated;
GRANT ALL ON public.responsibility_owners TO service_role;

ALTER TABLE public.responsibility_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan lasa omradesagare"
  ON public.responsibility_owners FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin eller HR kan hantera omradesagare"
  ON public.responsibility_owners FOR ALL TO authenticated
  USING (public.is_in_admin_group(auth.uid()) OR public.is_in_hr_group(auth.uid()))
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR public.is_in_hr_group(auth.uid()));

-- ============================================================
-- onboarding_templates
-- ============================================================
CREATE TABLE public.onboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.onboarding_kind NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_templates TO authenticated;
GRANT ALL ON public.onboarding_templates TO service_role;

ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan lasa mallar"
  ON public.onboarding_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin eller HR kan hantera mallar"
  ON public.onboarding_templates FOR ALL TO authenticated
  USING (public.is_in_admin_group(auth.uid()) OR public.is_in_hr_group(auth.uid()))
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR public.is_in_hr_group(auth.uid()));

CREATE TRIGGER trg_onboarding_templates_updated_at
  BEFORE UPDATE ON public.onboarding_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- onboarding_template_tasks
-- ============================================================
CREATE TABLE public.onboarding_template_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text,
  category text,
  conditional text NOT NULL DEFAULT 'always',
  due_offset_days int NOT NULL DEFAULT 0,
  assignee_source public.onboarding_assignee_source NOT NULL,
  assignee_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_tool_id uuid REFERENCES public.tools(id) ON DELETE SET NULL,
  assignee_area_id uuid REFERENCES public.responsibility_areas(id) ON DELETE SET NULL,
  assignee_role text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onboarding_template_tasks_template ON public.onboarding_template_tasks(template_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_template_tasks TO authenticated;
GRANT ALL ON public.onboarding_template_tasks TO service_role;

ALTER TABLE public.onboarding_template_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan lasa mall-uppgifter"
  ON public.onboarding_template_tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin eller HR kan hantera mall-uppgifter"
  ON public.onboarding_template_tasks FOR ALL TO authenticated
  USING (public.is_in_admin_group(auth.uid()) OR public.is_in_hr_group(auth.uid()))
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR public.is_in_hr_group(auth.uid()));

CREATE TRIGGER trg_onboarding_template_tasks_updated_at
  BEFORE UPDATE ON public.onboarding_template_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- onboarding_instances
-- ============================================================
CREATE TABLE public.onboarding_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE RESTRICT,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  prospective_name text,
  prospective_email text,
  prospective_title text,
  nearest_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date date,
  last_day date,
  exit_reason text CHECK (exit_reason IS NULL OR exit_reason IN ('voluntary','employer','retirement','other')),
  exit_type text CHECK (exit_type IS NULL OR exit_type IN ('normal','immediate')),
  legal_hold boolean NOT NULL DEFAULT false,
  status public.onboarding_instance_status NOT NULL DEFAULT 'draft',
  trigger_source text NOT NULL DEFAULT 'manual' CHECK (trigger_source IN ('manual','heartpace')),
  initiated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  cancel_reason text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onboarding_instances_template ON public.onboarding_instances(template_id);
CREATE INDEX idx_onboarding_instances_profile ON public.onboarding_instances(profile_id);
CREATE INDEX idx_onboarding_instances_manager ON public.onboarding_instances(nearest_manager_id);
CREATE INDEX idx_onboarding_instances_status ON public.onboarding_instances(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_instances TO authenticated;
GRANT ALL ON public.onboarding_instances TO service_role;

ALTER TABLE public.onboarding_instances ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.onboarding_instance_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  k public.onboarding_kind;
BEGIN
  SELECT kind INTO k FROM public.onboarding_templates WHERE id = NEW.template_id;
  IF k = 'offboarding' AND NEW.last_day IS NULL THEN
    RAISE EXCEPTION 'last_day kravs for offboarding-instans';
  END IF;
  IF k = 'onboarding' AND NEW.start_date IS NULL THEN
    RAISE EXCEPTION 'start_date kravs for onboarding-instans';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_onboarding_instance_validate
  BEFORE INSERT OR UPDATE ON public.onboarding_instances
  FOR EACH ROW EXECUTE FUNCTION public.onboarding_instance_validate();

CREATE TRIGGER trg_onboarding_instances_updated_at
  BEFORE UPDATE ON public.onboarding_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- onboarding_tasks
-- ============================================================
CREATE TABLE public.onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.onboarding_instances(id) ON DELETE CASCADE,
  template_task_id uuid REFERENCES public.onboarding_template_tasks(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text,
  category text,
  assignee_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_email text,
  assignee_label text,
  deadline_date date,
  status public.onboarding_task_status NOT NULL DEFAULT 'pending',
  done_at timestamptz,
  done_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  is_sensitive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onboarding_tasks_instance ON public.onboarding_tasks(instance_id);
CREATE INDEX idx_onboarding_tasks_assignee ON public.onboarding_tasks(assignee_profile_id);
CREATE INDEX idx_onboarding_tasks_status ON public.onboarding_tasks(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_tasks TO authenticated;
GRANT ALL ON public.onboarding_tasks TO service_role;

ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_onboarding_tasks_updated_at
  BEFORE UPDATE ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Helpers för task-/manager-koll
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_onboarding_task(_user_id uuid, _instance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_tasks ot
    JOIN public.profiles p ON p.id = ot.assignee_profile_id
    WHERE ot.instance_id = _instance_id
      AND p.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_nearest_manager_for_instance(_user_id uuid, _instance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_instances oi
    JOIN public.profiles p ON p.id = oi.nearest_manager_id
    WHERE oi.id = _instance_id AND p.user_id = _user_id
  );
$$;

-- ============================================================
-- RLS: instances
-- ============================================================
CREATE POLICY "HR eller admin ser alla instanser"
  ON public.onboarding_instances FOR SELECT TO authenticated
  USING (public.is_in_hr_group(auth.uid()) OR public.is_in_admin_group(auth.uid()));

CREATE POLICY "Narmaste chef ser sina instanser"
  ON public.onboarding_instances FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = onboarding_instances.nearest_manager_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Initiator ser sin instans"
  ON public.onboarding_instances FOR SELECT TO authenticated
  USING (initiated_by = auth.uid());

CREATE POLICY "Ansvarig for uppgift ser instansen"
  ON public.onboarding_instances FOR SELECT TO authenticated
  USING (public.has_onboarding_task(auth.uid(), id));

CREATE POLICY "Onboardee ser sin egen onboarding"
  ON public.onboarding_instances FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.onboarding_templates t ON t.id = onboarding_instances.template_id
      WHERE p.id = onboarding_instances.profile_id
        AND p.user_id = auth.uid()
        AND t.kind = 'onboarding'
    )
  );

CREATE POLICY "HR admin eller chef kan skapa instanser"
  ON public.onboarding_instances FOR INSERT TO authenticated
  WITH CHECK (
    public.is_in_hr_group(auth.uid())
    OR public.is_in_admin_group(auth.uid())
    OR public.is_in_manager_group(auth.uid())
  );

CREATE POLICY "HR eller admin kan uppdatera instanser"
  ON public.onboarding_instances FOR UPDATE TO authenticated
  USING (public.is_in_hr_group(auth.uid()) OR public.is_in_admin_group(auth.uid()))
  WITH CHECK (public.is_in_hr_group(auth.uid()) OR public.is_in_admin_group(auth.uid()));

CREATE POLICY "HR eller admin kan radera instanser"
  ON public.onboarding_instances FOR DELETE TO authenticated
  USING (public.is_in_hr_group(auth.uid()) OR public.is_in_admin_group(auth.uid()));

-- ============================================================
-- RLS: tasks
-- ============================================================
CREATE POLICY "HR eller admin ser alla uppgifter"
  ON public.onboarding_tasks FOR SELECT TO authenticated
  USING (public.is_in_hr_group(auth.uid()) OR public.is_in_admin_group(auth.uid()));

CREATE POLICY "Ansvarig ser sina uppgifter"
  ON public.onboarding_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = onboarding_tasks.assignee_profile_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Narmaste chef ser uppgifter pa sina instanser"
  ON public.onboarding_tasks FOR SELECT TO authenticated
  USING (public.is_nearest_manager_for_instance(auth.uid(), instance_id));

CREATE POLICY "Ansvarig kan bocka av sin uppgift"
  ON public.onboarding_tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = onboarding_tasks.assignee_profile_id
        AND p.user_id = auth.uid()
    )
    OR public.is_in_hr_group(auth.uid())
    OR public.is_in_admin_group(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = onboarding_tasks.assignee_profile_id
        AND p.user_id = auth.uid()
    )
    OR public.is_in_hr_group(auth.uid())
    OR public.is_in_admin_group(auth.uid())
  );

CREATE POLICY "HR eller admin kan hantera uppgifter"
  ON public.onboarding_tasks FOR ALL TO authenticated
  USING (public.is_in_hr_group(auth.uid()) OR public.is_in_admin_group(auth.uid()))
  WITH CHECK (public.is_in_hr_group(auth.uid()) OR public.is_in_admin_group(auth.uid()));

-- ============================================================
-- onboarding_external_tokens
-- ============================================================
CREATE TABLE public.onboarding_external_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.onboarding_instances(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  email text NOT NULL,
  label text,
  task_ids uuid[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onboarding_external_tokens_instance ON public.onboarding_external_tokens(instance_id);
CREATE INDEX idx_onboarding_external_tokens_token ON public.onboarding_external_tokens(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_external_tokens TO authenticated;
GRANT ALL ON public.onboarding_external_tokens TO service_role;

ALTER TABLE public.onboarding_external_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR eller admin hanterar externa tokens"
  ON public.onboarding_external_tokens FOR ALL TO authenticated
  USING (public.is_in_hr_group(auth.uid()) OR public.is_in_admin_group(auth.uid()))
  WITH CHECK (public.is_in_hr_group(auth.uid()) OR public.is_in_admin_group(auth.uid()));

-- ============================================================
-- onboarding_email_log
-- ============================================================
CREATE TABLE public.onboarding_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.onboarding_instances(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  recipient_email text NOT NULL,
  recipient_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  error text
);

CREATE INDEX idx_onboarding_email_log_instance ON public.onboarding_email_log(instance_id);

GRANT SELECT, INSERT ON public.onboarding_email_log TO authenticated;
GRANT ALL ON public.onboarding_email_log TO service_role;

ALTER TABLE public.onboarding_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR eller admin ser email-loggen"
  ON public.onboarding_email_log FOR SELECT TO authenticated
  USING (public.is_in_hr_group(auth.uid()) OR public.is_in_admin_group(auth.uid()));

CREATE POLICY "HR eller admin kan logga mejl"
  ON public.onboarding_email_log FOR INSERT TO authenticated
  WITH CHECK (public.is_in_hr_group(auth.uid()) OR public.is_in_admin_group(auth.uid()));

-- ============================================================
-- orders: koppling till instans
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS onboarding_instance_id uuid REFERENCES public.onboarding_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offboarding_instance_id uuid REFERENCES public.onboarding_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_onboarding_instance
  ON public.orders(onboarding_instance_id) WHERE onboarding_instance_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_offboarding_instance
  ON public.orders(offboarding_instance_id) WHERE offboarding_instance_id IS NOT NULL;
