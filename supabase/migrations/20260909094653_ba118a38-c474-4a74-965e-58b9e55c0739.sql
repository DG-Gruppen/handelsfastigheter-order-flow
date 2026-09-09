-- ============================================================
-- On-/Offboarding v2 ("boarding")
--
-- Byggs vid sidan av v1 (onboarding_*). Inget i v1 rörs. Delade
-- organisationsregister (tools, tool_owners, responsibility_areas,
-- external_contacts, groups, profiles) återanvänds.
--
-- Flöde: Heartpace/HR först → chef gör sina val → uppgifter resolvas
-- per ansvarig → utskick → avbockning → klart.
-- ============================================================

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
CREATE TYPE public.boarding_kind AS ENUM ('onboarding', 'offboarding');
CREATE TYPE public.boarding_case_status AS ENUM ('awaiting_manager', 'awaiting_hr', 'active', 'completed', 'cancelled');
CREATE TYPE public.boarding_task_status AS ENUM ('pending', 'done', 'not_applicable');
CREATE TYPE public.boarding_assignee_source AS ENUM ('static_profile', 'tool_owner', 'area_owner', 'group', 'nearest_manager', 'external_contact');
CREATE TYPE public.boarding_trigger_source AS ENUM ('heartpace', 'manual', 'simulated');

-- ------------------------------------------------------------
-- RLS-helper: admin, HR eller IT ("staff" i boarding-sammanhang)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.boarding_is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_in_admin_group(_user_id)
      OR public.is_in_hr_group(_user_id)
      OR public.is_in_it_group(_user_id);
$$;

-- ------------------------------------------------------------
-- boarding_templates
-- ------------------------------------------------------------
CREATE TABLE public.boarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.boarding_kind NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  -- true = HR bekräftar efter chefens inskick innan utskick går ut
  require_hr_confirm boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boarding_templates TO authenticated;
GRANT ALL ON public.boarding_templates TO service_role;
ALTER TABLE public.boarding_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boarding_templates: alla inloggade laser"
  ON public.boarding_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "boarding_templates: staff hanterar"
  ON public.boarding_templates FOR ALL TO authenticated
  USING (public.boarding_is_staff(auth.uid()))
  WITH CHECK (public.boarding_is_staff(auth.uid()));

CREATE TRIGGER trg_boarding_templates_updated_at
  BEFORE UPDATE ON public.boarding_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- boarding_template_tasks
--
-- condition_key styr när en uppgift tas med:
--   NULL                → alltid
--   manuella nycklar    → chefen kryssar i (company_car, id06, bank, ...)
--   auto-nycklar        → utvärderas från ärendet:
--       location_stockholm  ort innehåller "stockholm"
--       trigger_manual      ärendet kom inte från Heartpace
-- is_system_access = true → uppgiften är en systembehörighet och visas
-- som valbart system för chefen; tas med om assignee_tool_id är valt.
-- ------------------------------------------------------------
CREATE TABLE public.boarding_template_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.boarding_templates(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text,
  category text,
  condition_key text,
  condition_label text,
  is_system_access boolean NOT NULL DEFAULT false,
  due_offset_days int NOT NULL DEFAULT 0,
  assignee_source public.boarding_assignee_source NOT NULL,
  assignee_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_tool_id uuid REFERENCES public.tools(id) ON DELETE SET NULL,
  assignee_area_id uuid REFERENCES public.responsibility_areas(id) ON DELETE SET NULL,
  assignee_external_contact_id uuid REFERENCES public.external_contacts(id) ON DELETE SET NULL,
  assignee_group_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boarding_template_tasks_system_access_needs_tool
    CHECK (NOT is_system_access OR assignee_tool_id IS NOT NULL)
);

CREATE INDEX idx_boarding_template_tasks_template ON public.boarding_template_tasks(template_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boarding_template_tasks TO authenticated;
GRANT ALL ON public.boarding_template_tasks TO service_role;
ALTER TABLE public.boarding_template_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boarding_template_tasks: alla inloggade laser"
  ON public.boarding_template_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "boarding_template_tasks: staff hanterar"
  ON public.boarding_template_tasks FOR ALL TO authenticated
  USING (public.boarding_is_staff(auth.uid()))
  WITH CHECK (public.boarding_is_staff(auth.uid()));

CREATE TRIGGER trg_boarding_template_tasks_updated_at
  BEFORE UPDATE ON public.boarding_template_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- boarding_cases (ett ärende per person)
-- ------------------------------------------------------------
CREATE TABLE public.boarding_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.boarding_kind NOT NULL,
  template_id uuid NOT NULL REFERENCES public.boarding_templates(id) ON DELETE RESTRICT,
  status public.boarding_case_status NOT NULL DEFAULT 'awaiting_manager',
  trigger_source public.boarding_trigger_source NOT NULL DEFAULT 'manual',

  -- Personen (fältkontraktet mot Heartpace)
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  heartpace_employee_id text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  work_email text,
  personal_email text,
  title text,
  department text,
  location text,
  cost_centre text,
  employment_form text,

  -- Chef: kopplad profil, plus råvärdet från Heartpace om kopplingen misslyckades
  nearest_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  manager_name_raw text,

  -- Datum
  start_date date,
  last_day date,
  exit_reason text CHECK (exit_reason IS NULL OR exit_reason IN ('voluntary', 'employer', 'retirement', 'other')),
  exit_type text CHECK (exit_type IS NULL OR exit_type IN ('normal', 'immediate')),

  -- Chefens val
  selected_tool_ids uuid[] NOT NULL DEFAULT '{}',
  optional_keys text[] NOT NULL DEFAULT '{}',
  manager_submitted_at timestamptz,
  manager_submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- HR-grind (om mallen kräver den)
  hr_confirmed_at timestamptz,
  hr_confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Google Workspace-provisionering (byggs i senare etapp)
  google_account_status text NOT NULL DEFAULT 'not_requested'
    CHECK (google_account_status IN ('not_requested', 'pending', 'created', 'failed', 'suspended')),
  google_account_email text,

  notes text,
  cancel_reason text,
  initiated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_boarding_cases_template ON public.boarding_cases(template_id);
CREATE INDEX idx_boarding_cases_profile ON public.boarding_cases(profile_id);
CREATE INDEX idx_boarding_cases_manager ON public.boarding_cases(nearest_manager_id);
CREATE INDEX idx_boarding_cases_status ON public.boarding_cases(status);
CREATE INDEX idx_boarding_cases_kind ON public.boarding_cases(kind);
-- En Heartpace-anställd får bara ha ett öppet ärende per typ
CREATE UNIQUE INDEX uq_boarding_cases_open_heartpace
  ON public.boarding_cases(heartpace_employee_id, kind)
  WHERE heartpace_employee_id IS NOT NULL AND status NOT IN ('completed', 'cancelled');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boarding_cases TO authenticated;
GRANT ALL ON public.boarding_cases TO service_role;
ALTER TABLE public.boarding_cases ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.boarding_case_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  k public.boarding_kind;
BEGIN
  SELECT kind INTO k FROM public.boarding_templates WHERE id = NEW.template_id;
  IF k IS DISTINCT FROM NEW.kind THEN
    RAISE EXCEPTION 'Mallens typ (%) matchar inte arendets typ (%)', k, NEW.kind;
  END IF;
  IF NEW.kind = 'onboarding' AND NEW.start_date IS NULL THEN
    RAISE EXCEPTION 'start_date kravs for onboarding';
  END IF;
  IF NEW.kind = 'offboarding' AND NEW.last_day IS NULL THEN
    RAISE EXCEPTION 'last_day kravs for offboarding';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_boarding_case_validate
  BEFORE INSERT OR UPDATE ON public.boarding_cases
  FOR EACH ROW EXECUTE FUNCTION public.boarding_case_validate();

CREATE TRIGGER trg_boarding_cases_updated_at
  BEFORE UPDATE ON public.boarding_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- boarding_case_tasks (snapshot av mallen per ärende)
-- ------------------------------------------------------------
CREATE TABLE public.boarding_case_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.boarding_cases(id) ON DELETE CASCADE,
  template_task_id uuid REFERENCES public.boarding_template_tasks(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text,
  category text,
  condition_key text,
  assignee_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_external_contact_id uuid REFERENCES public.external_contacts(id) ON DELETE SET NULL,
  assignee_email text,
  assignee_label text,
  deadline_date date,
  status public.boarding_task_status NOT NULL DEFAULT 'pending',
  done_at timestamptz,
  done_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_boarding_case_tasks_case ON public.boarding_case_tasks(case_id);
CREATE INDEX idx_boarding_case_tasks_assignee ON public.boarding_case_tasks(assignee_profile_id);
CREATE INDEX idx_boarding_case_tasks_status ON public.boarding_case_tasks(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boarding_case_tasks TO authenticated;
GRANT ALL ON public.boarding_case_tasks TO service_role;
ALTER TABLE public.boarding_case_tasks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_boarding_case_tasks_updated_at
  BEFORE UPDATE ON public.boarding_case_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- boarding_email_log
-- ------------------------------------------------------------
CREATE TABLE public.boarding_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.boarding_cases(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  recipient_email text NOT NULL,
  recipient_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  redirected_from text,
  payload jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  error text
);

CREATE INDEX idx_boarding_email_log_case ON public.boarding_email_log(case_id);

GRANT SELECT ON public.boarding_email_log TO authenticated;
GRANT ALL ON public.boarding_email_log TO service_role;
ALTER TABLE public.boarding_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boarding_email_log: staff laser"
  ON public.boarding_email_log FOR SELECT TO authenticated
  USING (public.boarding_is_staff(auth.uid()));

-- ------------------------------------------------------------
-- RLS-helpers för ärenden
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.boarding_is_manager(_user_id uuid, _case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boarding_cases c
    JOIN public.profiles p ON p.id = c.nearest_manager_id
    WHERE c.id = _case_id AND p.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.boarding_has_task(_user_id uuid, _case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boarding_case_tasks t
    JOIN public.profiles p ON p.id = t.assignee_profile_id
    WHERE t.case_id = _case_id AND p.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.boarding_can_view_case(_user_id uuid, _case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.boarding_is_staff(_user_id)
      OR public.boarding_is_manager(_user_id, _case_id)
      OR public.boarding_has_task(_user_id, _case_id)
      OR EXISTS (
        SELECT 1 FROM public.boarding_cases c
        WHERE c.id = _case_id AND c.initiated_by = _user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.boarding_cases c
        JOIN public.profiles p ON p.id = c.profile_id
        WHERE c.id = _case_id AND c.kind = 'onboarding' AND p.user_id = _user_id
      );
$$;

-- ------------------------------------------------------------
-- RLS: boarding_cases
-- ------------------------------------------------------------
CREATE POLICY "boarding_cases: ser arenden man har koppling till"
  ON public.boarding_cases FOR SELECT TO authenticated
  USING (public.boarding_can_view_case(auth.uid(), id));

CREATE POLICY "boarding_cases: staff eller chef skapar"
  ON public.boarding_cases FOR INSERT TO authenticated
  WITH CHECK (public.boarding_is_staff(auth.uid()) OR public.is_in_manager_group(auth.uid()));

-- Chefens inskick och statusövergångar går via edge function (service role).
CREATE POLICY "boarding_cases: staff uppdaterar"
  ON public.boarding_cases FOR UPDATE TO authenticated
  USING (public.boarding_is_staff(auth.uid()))
  WITH CHECK (public.boarding_is_staff(auth.uid()));

CREATE POLICY "boarding_cases: admin raderar"
  ON public.boarding_cases FOR DELETE TO authenticated
  USING (public.is_in_admin_group(auth.uid()));

-- ------------------------------------------------------------
-- RLS: boarding_case_tasks
-- ------------------------------------------------------------
CREATE POLICY "boarding_case_tasks: ser uppgifter i synliga arenden"
  ON public.boarding_case_tasks FOR SELECT TO authenticated
  USING (public.boarding_can_view_case(auth.uid(), case_id));

CREATE POLICY "boarding_case_tasks: ansvarig, chef eller staff bockar av"
  ON public.boarding_case_tasks FOR UPDATE TO authenticated
  USING (
    public.boarding_is_staff(auth.uid())
    OR public.boarding_is_manager(auth.uid(), case_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = boarding_case_tasks.assignee_profile_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.boarding_is_staff(auth.uid())
    OR public.boarding_is_manager(auth.uid(), case_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = boarding_case_tasks.assignee_profile_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "boarding_case_tasks: staff skapar och raderar"
  ON public.boarding_case_tasks FOR INSERT TO authenticated
  WITH CHECK (public.boarding_is_staff(auth.uid()));
CREATE POLICY "boarding_case_tasks: staff raderar"
  ON public.boarding_case_tasks FOR DELETE TO authenticated
  USING (public.boarding_is_staff(auth.uid()));

-- ============================================================
-- Modul: synlig för admin och IT under bygget
-- ============================================================
INSERT INTO public.modules (name, slug, route, icon, description, sort_order, is_active)
SELECT 'On-/Offboarding v2', 'boarding-v2', '/boardingv2', 'user-plus',
       'Ny on-/offboarding (byggs vid sidan av nuvarande)',
       COALESCE((SELECT sort_order FROM public.modules WHERE slug = 'onboarding'), 0) + 1,
       true
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'boarding-v2');

INSERT INTO public.module_role_access (module_id, role, has_access)
SELECT m.id, r.role, true
FROM public.modules m
CROSS JOIN (VALUES ('admin'::public.app_role), ('it'::public.app_role)) AS r(role)
WHERE m.slug = 'boarding-v2'
ON CONFLICT (module_id, role) DO NOTHING;

-- ============================================================
-- Seed: delade register som mallen behöver
-- ============================================================

-- HR-grupp (fanns inte; is_in_hr_group matchar på namnet)
INSERT INTO public.groups (name, description, role_equivalent, is_system)
SELECT 'HR', 'Personalfunktionen – mottagare av HR-uppgifter i on-/offboarding', NULL, false
WHERE NOT EXISTS (SELECT 1 FROM public.groups WHERE name = 'HR');

INSERT INTO public.group_members (group_id, user_id)
SELECT g.id, p.user_id
FROM public.groups g, public.profiles p
WHERE g.name = 'HR'
  AND p.email = 'petra.bondesson@handelsfastigheter.se'
  AND p.user_id IS NOT NULL
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Verktyg som saknas i registret men står i Petras checklista.
-- Inaktiva tills url och beskrivning finns – syns då inte på /verktyg,
-- men ägarkopplingen fungerar för behörighetsuppgifter.
INSERT INTO public.tools (name, description, url, is_active, sort_order)
SELECT v.name, v.description, '', false, 900
FROM (VALUES
  ('Rekyl', 'Systembehörighet (onboarding). Aktivera och lägg till länk för att visa på Verktyg.'),
  ('IT-hotellet', 'Systembehörighet (onboarding). Aktivera och lägg till länk för att visa på Verktyg.'),
  ('Bereko', 'Systembehörighet (onboarding). Aktivera och lägg till länk för att visa på Verktyg.')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM public.tools t WHERE t.name = v.name);

INSERT INTO public.tool_owners (tool_id, profile_id)
SELECT t.id, p.id
FROM (VALUES
  ('Rekyl', 'emma.lundberg@handelsfastigheter.se'),
  ('IT-hotellet', 'emma.lundberg@handelsfastigheter.se'),
  ('Bereko', 'jorgen.seegh@handelsfastigheter.se')
) AS v(tool_name, email)
JOIN public.tools t ON t.name = v.tool_name
JOIN public.profiles p ON p.email = v.email
WHERE NOT EXISTS (
  SELECT 1 FROM public.tool_owners o WHERE o.tool_id = t.id AND o.profile_id = p.id
);

-- Ansvarsområden (uppgifter som inte är systembehörigheter)
INSERT INTO public.responsibility_areas (slug, name, description)
SELECT v.slug, v.name, v.description
FROM (VALUES
  ('nycklar-passage', 'Nycklar & passage', 'Nycklar, blipp, passerkort och ID06'),
  ('uniguide-fastighetslistor', 'Uniguide & fastighetslistor', 'Uniguide, What''s Up-gruppen Kris, fastighetslistor till Uniguide/Fastighetssnabben'),
  ('webb-intranat-kontakt', 'Kontaktuppgifter webb & intranät', 'Kontaktuppgifter på handelsfastigheter.se och intranätet'),
  ('bankbehorighet', 'Bankbehörighet', 'Behörighet i bank (om aktuellt)')
) AS v(slug, name, description)
WHERE NOT EXISTS (SELECT 1 FROM public.responsibility_areas a WHERE a.slug = v.slug);

INSERT INTO public.responsibility_owners (area_id, profile_id)
SELECT a.id, p.id
FROM (VALUES
  ('nycklar-passage', 'christel.johansson@handelsfastigheter.se'),
  ('uniguide-fastighetslistor', 'christel.johansson@handelsfastigheter.se'),
  ('webb-intranat-kontakt', 'inga.pahlsson@handelsfastigheter.se'),
  ('bankbehorighet', 'emma.lundberg@handelsfastigheter.se')
) AS v(slug, email)
JOIN public.responsibility_areas a ON a.slug = v.slug
JOIN public.profiles p ON p.email = v.email
ON CONFLICT (area_id, profile_id) DO NOTHING;

-- Extern kontakt: Fastighetssnabben
INSERT INTO public.external_contacts (company_name, full_name, email, is_active, notes)
SELECT 'Fastighetssnabben', 'Agnes Eriksson', 'agnes.eriksson@fastighetssnabben.se', true,
       'Collectum (tjänstepension) och Spiris (tid- och utläggsrapportering)'
WHERE NOT EXISTS (SELECT 1 FROM public.external_contacts WHERE email = 'agnes.eriksson@fastighetssnabben.se');

-- ============================================================
-- Seed: mallar (Petras checklista, Onboarding 2026)
-- ============================================================
DO $seed$
DECLARE
  tpl_on uuid;
  tpl_off uuid;
  area_keys uuid;
  area_uniguide uuid;
  area_web uuid;
  area_bank uuid;
  ext_agnes uuid;
  t_rillion uuid; t_vitec uuid; t_rekyl uuid; t_ithotell uuid; t_creditsafe uuid;
  t_momentum uuid; t_webport uuid; t_bereko uuid; t_ibinder uuid; t_metry uuid;
  t_vyer uuid; t_zendesk uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.boarding_templates WHERE name = 'SHF Onboarding') THEN
    RETURN;
  END IF;

  SELECT id INTO area_keys     FROM public.responsibility_areas WHERE slug = 'nycklar-passage';
  SELECT id INTO area_uniguide FROM public.responsibility_areas WHERE slug = 'uniguide-fastighetslistor';
  SELECT id INTO area_web      FROM public.responsibility_areas WHERE slug = 'webb-intranat-kontakt';
  SELECT id INTO area_bank     FROM public.responsibility_areas WHERE slug = 'bankbehorighet';
  SELECT id INTO ext_agnes     FROM public.external_contacts WHERE email = 'agnes.eriksson@fastighetssnabben.se';

  SELECT id INTO t_rillion    FROM public.tools WHERE name = 'Rillion';
  SELECT id INTO t_vitec      FROM public.tools WHERE name = 'Vitec';
  SELECT id INTO t_rekyl      FROM public.tools WHERE name = 'Rekyl';
  SELECT id INTO t_ithotell   FROM public.tools WHERE name = 'IT-hotellet';
  SELECT id INTO t_creditsafe FROM public.tools WHERE name = 'Creditsafe';
  SELECT id INTO t_momentum   FROM public.tools WHERE name = 'Momentum';
  SELECT id INTO t_webport    FROM public.tools WHERE name = 'Webport';
  SELECT id INTO t_bereko     FROM public.tools WHERE name = 'Bereko';
  SELECT id INTO t_ibinder    FROM public.tools WHERE name = 'iBinder';
  SELECT id INTO t_metry      FROM public.tools WHERE name = 'Metry';
  SELECT id INTO t_vyer       FROM public.tools WHERE name = 'Vyer';
  SELECT id INTO t_zendesk    FROM public.tools WHERE name = 'Zendesk';

  -- ---------------- Onboarding ----------------
  INSERT INTO public.boarding_templates (kind, name, description, is_default, require_hr_confirm)
  VALUES ('onboarding', 'SHF Onboarding', 'Checklista enligt Onboarding 2026 (Petra). Systembehörigheter väljs av närmaste chef.', true, false)
  RETURNING id INTO tpl_on;

  INSERT INTO public.boarding_template_tasks
    (template_id, sort_order, category, title, description, condition_key, condition_label, is_system_access, due_offset_days,
     assignee_source, assignee_group_name, assignee_area_id, assignee_external_contact_id, assignee_tool_id)
  VALUES
  -- Registrering och avtal (HR)
  (tpl_on, 10, 'Registrering och avtal', 'Lägg upp den nyanställdes uppgifter och anställningsavtal i Heartpace', NULL, 'trigger_manual', NULL, false, -14, 'group', 'HR', NULL, NULL, NULL),
  (tpl_on, 20, 'Registrering och avtal', 'Skicka anställningsavtal till Fastighetssnabben', 'Med information om attestant, mejladress, mobilnummer, chef och kostnadsställe.', NULL, NULL, false, -14, 'group', 'HR', NULL, NULL, NULL),
  (tpl_on, 30, 'Registrering och avtal', 'Lagra anställningsavtalet digitalt i HR-mappen och i Heartpace', NULL, NULL, NULL, false, -14, 'group', 'HR', NULL, NULL, NULL),
  (tpl_on, 40, 'Registrering och avtal', 'Uppdatera anställningsförteckningen', NULL, NULL, NULL, false, -7, 'group', 'HR', NULL, NULL, NULL),
  (tpl_on, 50, 'Registrering och avtal', 'Uppdatera organisationsschemat (cc IT)', NULL, NULL, NULL, false, -7, 'group', 'HR', NULL, NULL, NULL),
  -- Försäkringar och pension
  (tpl_on, 60, 'Försäkringar och pension', 'Registrera sjukvårdsförsäkring och tjänstegrupplivförsäkring hos Bliwa', 'Via https://securemail.bliwa.se och mejl till affarsstod@bliwa.se.', NULL, NULL, false, -7, 'group', 'HR', NULL, NULL, NULL),
  (tpl_on, 70, 'Försäkringar och pension', 'Registrera tjänstepension hos Collectum', NULL, NULL, NULL, false, -7, 'external_contact', NULL, NULL, ext_agnes, NULL),
  (tpl_on, 80, 'Försäkringar och pension', 'Lägg upp behörigheter för tidrapportering och utläggsrapportering i Spiris', NULL, NULL, NULL, false, -7, 'external_contact', NULL, NULL, ext_agnes, NULL),
  (tpl_on, 90, 'Försäkringar och pension', 'Beställ tjänstebil', 'Tillsammans med den nyanställde och Svea Leasing.', 'company_car', 'Tjänstebil', false, -14, 'group', 'HR', NULL, NULL, NULL),
  -- Information och introduktion (närmaste chef)
  (tpl_on, 100, 'Information och introduktion', 'Skicka information till organisationen om den nya medarbetaren', NULL, NULL, NULL, false, -7, 'nearest_manager', NULL, NULL, NULL, NULL),
  (tpl_on, 110, 'Information och introduktion', 'Skicka välkomstmejl till den nya medarbetaren', 'Tid att ses, första veckan m.m.', NULL, NULL, false, -7, 'nearest_manager', NULL, NULL, NULL, NULL),
  (tpl_on, 120, 'Information och introduktion', 'Planera och skicka ut info om introduktion på avdelningen', NULL, NULL, NULL, false, -7, 'nearest_manager', NULL, NULL, NULL, NULL),
  (tpl_on, 130, 'Information och introduktion', 'Boka introduktion på HK med nyckelpersoner', 'I samråd med HR. Ekonomi/Finans: Malin o Sara · Avtal/Avtalskoordinatorerna: Marit, Camilla, Amanda o Marika · Transaktion: Mimmi & Jöran · Affärsutveckling · Projekt: Emma · Hållbarhet: Wilma · HR: Petra', NULL, NULL, false, -7, 'nearest_manager', NULL, NULL, NULL, NULL),
  (tpl_on, 140, 'Information och introduktion', 'Boka lunch första dagen', NULL, NULL, NULL, false, -3, 'nearest_manager', NULL, NULL, NULL, NULL),
  (tpl_on, 150, 'Information och introduktion', 'Beställ blomma', NULL, NULL, NULL, false, -3, 'nearest_manager', NULL, NULL, NULL, NULL),
  -- Utrustning och passage
  (tpl_on, 160, 'Utrustning och passage', 'Beställ dator och mobil via beställningsformuläret', 'Beställ under Beställningar → Ny beställning.', NULL, NULL, false, -14, 'nearest_manager', NULL, NULL, NULL, NULL),
  (tpl_on, 170, 'Utrustning och passage', 'Ordna nycklar, blipp eller passerkort (Stockholm)', NULL, 'location_stockholm', 'Placering i Stockholm', false, -3, 'area_owner', NULL, area_keys, NULL, NULL),
  (tpl_on, 180, 'Utrustning och passage', 'Beställ ID06-kort', NULL, 'id06', 'ID06-kort', false, -7, 'area_owner', NULL, area_keys, NULL, NULL),
  -- Behörigheter i system (väljs av chefen)
  (tpl_on, 200, 'Behörigheter i system', 'Skapa behörighet i Rillion', NULL, NULL, NULL, true, -3, 'tool_owner', NULL, NULL, NULL, t_rillion),
  (tpl_on, 210, 'Behörigheter i system', 'Skapa behörighet i Vitec/3L', NULL, NULL, NULL, true, -3, 'tool_owner', NULL, NULL, NULL, t_vitec),
  (tpl_on, 220, 'Behörigheter i system', 'Skapa behörighet i Rekyl', NULL, NULL, NULL, true, -3, 'tool_owner', NULL, NULL, NULL, t_rekyl),
  (tpl_on, 230, 'Behörigheter i system', 'Skapa behörighet i IT-hotellet', NULL, NULL, NULL, true, -3, 'tool_owner', NULL, NULL, NULL, t_ithotell),
  (tpl_on, 240, 'Behörigheter i system', 'Skapa behörighet till Bank', NULL, 'bank', 'Bankbehörighet', false, -3, 'area_owner', NULL, area_bank, NULL, NULL),
  (tpl_on, 250, 'Behörigheter i system', 'Skapa behörighet i Creditsafe', NULL, NULL, NULL, true, -3, 'tool_owner', NULL, NULL, NULL, t_creditsafe),
  (tpl_on, 260, 'Behörigheter i system', 'Skapa behörighet i Momentum', 'Ägare enligt verktygsregistret. Petras dokument anger Wilma Norin – bekräfta.', NULL, NULL, true, -3, 'tool_owner', NULL, NULL, NULL, t_momentum),
  (tpl_on, 270, 'Behörigheter i system', 'Skapa behörighet i Webport', NULL, NULL, NULL, true, -3, 'tool_owner', NULL, NULL, NULL, t_webport),
  (tpl_on, 280, 'Behörigheter i system', 'Skapa behörighet i Bereko', NULL, NULL, NULL, true, -3, 'tool_owner', NULL, NULL, NULL, t_bereko),
  (tpl_on, 290, 'Behörigheter i system', 'Skapa behörighet i iBinder', NULL, NULL, NULL, true, -3, 'tool_owner', NULL, NULL, NULL, t_ibinder),
  (tpl_on, 300, 'Behörigheter i system', 'Skapa behörighet i Metry', NULL, NULL, NULL, true, -3, 'tool_owner', NULL, NULL, NULL, t_metry),
  (tpl_on, 310, 'Behörigheter i system', 'Skapa behörighet i Vyer', NULL, NULL, NULL, true, -3, 'tool_owner', NULL, NULL, NULL, t_vyer),
  (tpl_on, 320, 'Behörigheter i system', 'Skapa behörighet i Zendesk', NULL, NULL, NULL, true, -3, 'tool_owner', NULL, NULL, NULL, t_zendesk),
  (tpl_on, 330, 'Behörigheter i system', 'Skapa Google Workspace-konto', 'Konto i rätt organisationsenhet med licens. Automatiseras i senare etapp.', NULL, NULL, false, -7, 'group', 'IT', NULL, NULL, NULL),
  -- Första dagen (närmaste chef)
  (tpl_on, 400, 'Första dagen – introduktion på HK', 'Visning av kontoret', 'Utrymningsvägar, uppsamlingsplats, hjärtstartare, mötesrum, garage, kök m.m.', NULL, NULL, false, 0, 'nearest_manager', NULL, NULL, NULL, NULL),
  (tpl_on, 410, 'Första dagen – introduktion på HK', 'Presentationsrunda', NULL, NULL, NULL, false, 0, 'nearest_manager', NULL, NULL, NULL, NULL),
  (tpl_on, 420, 'Första dagen – introduktion på HK', 'Genomgång av mål och ansvar', NULL, NULL, NULL, false, 0, 'nearest_manager', NULL, NULL, NULL, NULL),
  -- Övriga aviseringar
  (tpl_on, 500, 'Övriga aviseringar', 'Lägg till den nyanställde i Uniguide och i What''s Up-gruppen Kris', NULL, NULL, NULL, false, -3, 'area_owner', NULL, area_uniguide, NULL, NULL),
  (tpl_on, 510, 'Övriga aviseringar', 'Förändringar i fastighetslistor till Uniguide/Fastighetssnabben', NULL, NULL, NULL, false, -3, 'area_owner', NULL, area_uniguide, NULL, NULL),
  (tpl_on, 520, 'Övriga aviseringar', 'Lägg upp kontaktuppgifter på SHF:s webbsida och intranätet', NULL, NULL, NULL, false, 0, 'area_owner', NULL, area_web, NULL, NULL);

  -- ---------------- Offboarding (spegel, utkast) ----------------
  INSERT INTO public.boarding_templates (kind, name, description, is_default, require_hr_confirm)
  VALUES ('offboarding', 'SHF Offboarding', 'Spegel av onboardingen. Utkast – innehållet stäms av med HR.', true, false)
  RETURNING id INTO tpl_off;

  INSERT INTO public.boarding_template_tasks
    (template_id, sort_order, category, title, description, condition_key, condition_label, is_system_access, due_offset_days,
     assignee_source, assignee_group_name, assignee_area_id, assignee_external_contact_id, assignee_tool_id)
  VALUES
  (tpl_off, 10, 'Registrering och avtal', 'Registrera slutdatum och avslutsorsak i Heartpace', NULL, 'trigger_manual', NULL, false, -14, 'group', 'HR', NULL, NULL, NULL),
  (tpl_off, 20, 'Registrering och avtal', 'Uppdatera anställningsförteckning och organisationsschema (cc IT)', NULL, NULL, NULL, false, -3, 'group', 'HR', NULL, NULL, NULL),
  (tpl_off, 30, 'Försäkringar och pension', 'Avsluta försäkringar hos Bliwa', NULL, NULL, NULL, false, 0, 'group', 'HR', NULL, NULL, NULL),
  (tpl_off, 40, 'Försäkringar och pension', 'Avsluta tjänstepension (Collectum) och Spiris-behörighet', NULL, NULL, NULL, false, 0, 'external_contact', NULL, NULL, ext_agnes, NULL),
  (tpl_off, 100, 'Avslut och överlämning', 'Håll avslutssamtal', NULL, NULL, NULL, false, -3, 'nearest_manager', NULL, NULL, NULL, NULL),
  (tpl_off, 110, 'Avslut och överlämning', 'Informera organisationen', NULL, NULL, NULL, false, -3, 'nearest_manager', NULL, NULL, NULL, NULL),
  (tpl_off, 120, 'Avslut och överlämning', 'Säkerställ överlämning av pågående arbete', NULL, NULL, NULL, false, -3, 'nearest_manager', NULL, NULL, NULL, NULL),
  (tpl_off, 160, 'Utrustning och passage', 'Återta dator och mobil', NULL, NULL, NULL, false, 0, 'group', 'IT', NULL, NULL, NULL),
  (tpl_off, 170, 'Utrustning och passage', 'Återta nycklar, blipp, passerkort och ID06', NULL, NULL, NULL, false, 0, 'area_owner', NULL, area_keys, NULL, NULL),
  (tpl_off, 200, 'Behörigheter i system', 'Avsluta behörighet i Rillion', NULL, NULL, NULL, true, 0, 'tool_owner', NULL, NULL, NULL, t_rillion),
  (tpl_off, 210, 'Behörigheter i system', 'Avsluta behörighet i Vitec/3L', NULL, NULL, NULL, true, 0, 'tool_owner', NULL, NULL, NULL, t_vitec),
  (tpl_off, 220, 'Behörigheter i system', 'Avsluta behörighet i Rekyl', NULL, NULL, NULL, true, 0, 'tool_owner', NULL, NULL, NULL, t_rekyl),
  (tpl_off, 230, 'Behörigheter i system', 'Avsluta behörighet i IT-hotellet', NULL, NULL, NULL, true, 0, 'tool_owner', NULL, NULL, NULL, t_ithotell),
  (tpl_off, 240, 'Behörigheter i system', 'Avsluta behörighet till Bank', NULL, 'bank', 'Bankbehörighet', false, 0, 'area_owner', NULL, area_bank, NULL, NULL),
  (tpl_off, 250, 'Behörigheter i system', 'Avsluta behörighet i Creditsafe', NULL, NULL, NULL, true, 0, 'tool_owner', NULL, NULL, NULL, t_creditsafe),
  (tpl_off, 260, 'Behörigheter i system', 'Avsluta behörighet i Momentum', NULL, NULL, NULL, true, 0, 'tool_owner', NULL, NULL, NULL, t_momentum),
  (tpl_off, 270, 'Behörigheter i system', 'Avsluta behörighet i Webport', NULL, NULL, NULL, true, 0, 'tool_owner', NULL, NULL, NULL, t_webport),
  (tpl_off, 280, 'Behörigheter i system', 'Avsluta behörighet i Bereko', NULL, NULL, NULL, true, 0, 'tool_owner', NULL, NULL, NULL, t_bereko),
  (tpl_off, 290, 'Behörigheter i system', 'Avsluta behörighet i iBinder', NULL, NULL, NULL, true, 0, 'tool_owner', NULL, NULL, NULL, t_ibinder),
  (tpl_off, 300, 'Behörigheter i system', 'Avsluta behörighet i Metry', NULL, NULL, NULL, true, 0, 'tool_owner', NULL, NULL, NULL, t_metry),
  (tpl_off, 310, 'Behörigheter i system', 'Avsluta behörighet i Vyer', NULL, NULL, NULL, true, 0, 'tool_owner', NULL, NULL, NULL, t_vyer),
  (tpl_off, 320, 'Behörigheter i system', 'Avsluta behörighet i Zendesk', NULL, NULL, NULL, true, 0, 'tool_owner', NULL, NULL, NULL, t_zendesk),
  (tpl_off, 330, 'Behörigheter i system', 'Stäng av Google Workspace-konto', 'Suspendera kontot sista dagen, vidarebefordra e-post enligt beslut.', NULL, NULL, false, 0, 'group', 'IT', NULL, NULL, NULL),
  (tpl_off, 500, 'Övriga aviseringar', 'Ta bort ur Uniguide och What''s Up-gruppen Kris', NULL, NULL, NULL, false, 0, 'area_owner', NULL, area_uniguide, NULL, NULL),
  (tpl_off, 510, 'Övriga aviseringar', 'Ta bort kontaktuppgifter från SHF:s webbsida och intranätet', NULL, NULL, NULL, false, 1, 'area_owner', NULL, area_web, NULL, NULL);
END
$seed$;