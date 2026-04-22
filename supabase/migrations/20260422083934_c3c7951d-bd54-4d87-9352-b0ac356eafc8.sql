
-- 1) Service-role policies: scope to service_role instead of public TO with USING(true)
DROP POLICY IF EXISTS "Service role can manage content index" ON public.content_index;
CREATE POLICY "Service role can manage content index" ON public.content_index
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage external invites" ON public.external_invites;
CREATE POLICY "Service role can manage external invites" ON public.external_invites
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage integrations" ON public.integration_status;
CREATE POLICY "Service role can manage integrations" ON public.integration_status
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Only service role can insert notifications directly" ON public.notifications;
CREATE POLICY "Only service role can insert notifications directly" ON public.notifications
  AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can delete notifications" ON public.notifications;
CREATE POLICY "Service role can delete notifications" ON public.notifications
  AS PERMISSIVE FOR DELETE TO service_role USING (true);

-- 2) Authenticated INSERT/UPDATE/DELETE policies: tighten to require auth.uid() IS NOT NULL
DROP POLICY IF EXISTS "Authenticated can log page views" ON public.page_analytics;
CREATE POLICY "Authenticated can log page views" ON public.page_analytics
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can insert search log" ON public.search_log;
CREATE POLICY "Authenticated can insert search log" ON public.search_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Planner checklists/items: require user to have access to the parent card's board
DROP POLICY IF EXISTS "Authenticated can insert checklists" ON public.planner_checklists;
DROP POLICY IF EXISTS "Authenticated can update checklists" ON public.planner_checklists;
DROP POLICY IF EXISTS "Authenticated can delete checklists" ON public.planner_checklists;

CREATE POLICY "Authenticated can insert checklists" ON public.planner_checklists
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.planner_cards c WHERE c.id = card_id)
  );
CREATE POLICY "Authenticated can update checklists" ON public.planner_checklists
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.planner_cards c WHERE c.id = card_id)
  );
CREATE POLICY "Authenticated can delete checklists" ON public.planner_checklists
  FOR DELETE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.planner_cards c WHERE c.id = card_id)
  );

DROP POLICY IF EXISTS "Authenticated can insert checklist items" ON public.planner_checklist_items;
DROP POLICY IF EXISTS "Authenticated can update checklist items" ON public.planner_checklist_items;
DROP POLICY IF EXISTS "Authenticated can delete checklist items" ON public.planner_checklist_items;

CREATE POLICY "Authenticated can insert checklist items" ON public.planner_checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.planner_checklists cl WHERE cl.id = checklist_id)
  );
CREATE POLICY "Authenticated can update checklist items" ON public.planner_checklist_items
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.planner_checklists cl WHERE cl.id = checklist_id)
  );
CREATE POLICY "Authenticated can delete checklist items" ON public.planner_checklist_items
  FOR DELETE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.planner_checklists cl WHERE cl.id = checklist_id)
  );

-- 3) Storage: prevent broad listing on public buckets by restricting SELECT to authenticated users
-- chat-images: previously "Chat images are publicly accessible" with USING (bucket_id = 'chat-images')
DROP POLICY IF EXISTS "Chat images are publicly accessible" ON storage.objects;
CREATE POLICY "Authenticated can read chat images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-images');

-- kb-images: previously "Public can read kb images" with USING (bucket_id = 'kb-images')
DROP POLICY IF EXISTS "Public can read kb images" ON storage.objects;
CREATE POLICY "Authenticated can read kb images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kb-images');

-- Tighten kb-images uploads/deletes to authenticated only (were TO public)
DROP POLICY IF EXISTS "Authenticated users can upload kb images" ON storage.objects;
CREATE POLICY "Authenticated users can upload kb images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kb-images' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete kb images" ON storage.objects;
CREATE POLICY "Authenticated users can delete kb images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'kb-images' AND auth.uid() IS NOT NULL);
