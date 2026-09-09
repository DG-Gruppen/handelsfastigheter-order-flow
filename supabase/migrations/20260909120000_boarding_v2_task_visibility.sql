-- ============================================================
-- Boarding v2: vanliga ansvariga ser bara sina egna uppgifter
--
-- Enligt planen (§7.3): HR/admin/IT och närmaste chef ser hela checklistan,
-- övriga ansvariga ser bara sina egna rader (direkt eller via grupp).
-- Personen själv ser ärendet men inga uppgifter.
-- boarding_case_progress ger "x av y klara" till alla som får se ärendet,
-- utan att avslöja vilka raderna är.
-- ============================================================

DROP POLICY IF EXISTS "boarding_case_tasks: ser uppgifter i synliga arenden" ON public.boarding_case_tasks;

CREATE POLICY "boarding_case_tasks: staff och chef ser alla, ansvarig ser sina"
  ON public.boarding_case_tasks FOR SELECT TO authenticated
  USING (
    public.boarding_is_staff(auth.uid())
    OR public.boarding_is_manager(auth.uid(), case_id)
    OR public.boarding_in_task_group(auth.uid(), assignee_group_name)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = boarding_case_tasks.assignee_profile_id AND p.user_id = auth.uid()
    )
  );

-- Övergripande status för ett ärende: total / klara / öppna.
-- Tomt (0/0/0) om anroparen inte får se ärendet.
CREATE OR REPLACE FUNCTION public.boarding_case_progress(_case_id uuid)
RETURNS TABLE (total int, done int, pending int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*)::int AS total,
    count(*) FILTER (WHERE t.status <> 'pending')::int AS done,
    count(*) FILTER (WHERE t.status = 'pending')::int AS pending
  FROM public.boarding_case_tasks t
  WHERE t.case_id = _case_id
    AND public.boarding_can_view_case(auth.uid(), _case_id);
$$;

REVOKE ALL ON FUNCTION public.boarding_case_progress(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.boarding_case_progress(uuid) TO authenticated, service_role;
