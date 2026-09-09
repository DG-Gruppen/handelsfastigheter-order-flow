-- ============================================================
-- Boarding v2: grupp-uppgifter som EN rad per grupp
--
-- Tidigare blev en mallrad med assignee_source = 'group' en uppgift per
-- gruppmedlem (t.ex. tre "Skapa Google Workspace-konto" till IT). Nu blir
-- den en enda uppgift märkt med gruppnamnet; alla medlemmar får mejlet och
-- vem som helst i gruppen kan bocka av.
-- ============================================================

ALTER TABLE public.boarding_case_tasks
  ADD COLUMN IF NOT EXISTS assignee_group_name text;

CREATE INDEX IF NOT EXISTS idx_boarding_case_tasks_group
  ON public.boarding_case_tasks(assignee_group_name)
  WHERE assignee_group_name IS NOT NULL;

-- Medlem i en grupp som har en uppgift i ärendet?
CREATE OR REPLACE FUNCTION public.boarding_in_task_group(_user_id uuid, _group_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _group_name IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = _user_id
      AND lower(g.name) = lower(_group_name)
  );
$$;

-- Synlighet: den som har en uppgift -- direkt eller via grupp -- ser ärendet
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
  ) OR EXISTS (
    SELECT 1 FROM public.boarding_case_tasks t
    WHERE t.case_id = _case_id
      AND public.boarding_in_task_group(_user_id, t.assignee_group_name)
  );
$$;

-- Avbockning: även gruppmedlem
DROP POLICY IF EXISTS "boarding_case_tasks: ansvarig, chef eller staff bockar av" ON public.boarding_case_tasks;
CREATE POLICY "boarding_case_tasks: ansvarig, grupp, chef eller staff bockar av"
  ON public.boarding_case_tasks FOR UPDATE TO authenticated
  USING (
    public.boarding_is_staff(auth.uid())
    OR public.boarding_is_manager(auth.uid(), case_id)
    OR public.boarding_in_task_group(auth.uid(), assignee_group_name)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = boarding_case_tasks.assignee_profile_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.boarding_is_staff(auth.uid())
    OR public.boarding_is_manager(auth.uid(), case_id)
    OR public.boarding_in_task_group(auth.uid(), assignee_group_name)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = boarding_case_tasks.assignee_profile_id AND p.user_id = auth.uid()
    )
  );