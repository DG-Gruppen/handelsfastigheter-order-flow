
-- ceo_blog
DROP POLICY IF EXISTS "Admins can manage ceo blog" ON public.ceo_blog;
CREATE POLICY "Admins can manage ceo blog" ON public.ceo_blog
  FOR ALL TO authenticated
  USING (is_in_admin_group(auth.uid()))
  WITH CHECK (is_in_admin_group(auth.uid()));

-- it_faq
DROP POLICY IF EXISTS "Editors can manage FAQ" ON public.it_faq;
CREATE POLICY "Editors can manage FAQ" ON public.it_faq
  FOR ALL TO authenticated
  USING (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'it-support'::text, 'edit'::text))
  WITH CHECK (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'it-support'::text, 'edit'::text));

-- kb_articles
DROP POLICY IF EXISTS "Editors can manage articles" ON public.kb_articles;
CREATE POLICY "Editors can manage articles" ON public.kb_articles
  FOR ALL TO authenticated
  USING (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken'::text, 'edit'::text))
  WITH CHECK (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken'::text, 'edit'::text));

DROP POLICY IF EXISTS "Editors can view all articles" ON public.kb_articles;
CREATE POLICY "Editors can view all articles" ON public.kb_articles
  FOR SELECT TO authenticated
  USING (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken'::text, 'edit'::text));

-- kb_categories
DROP POLICY IF EXISTS "Editors can manage kb_categories" ON public.kb_categories;
CREATE POLICY "Editors can manage kb_categories" ON public.kb_categories
  FOR ALL TO authenticated
  USING (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken'::text, 'edit'::text))
  WITH CHECK (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken'::text, 'edit'::text));

-- kb_videos
DROP POLICY IF EXISTS "Editors can manage videos" ON public.kb_videos;
CREATE POLICY "Editors can manage videos" ON public.kb_videos
  FOR ALL TO authenticated
  USING (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken'::text, 'edit'::text))
  WITH CHECK (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken'::text, 'edit'::text));

DROP POLICY IF EXISTS "Editors can view all videos" ON public.kb_videos;
CREATE POLICY "Editors can view all videos" ON public.kb_videos
  FOR SELECT TO authenticated
  USING (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken'::text, 'edit'::text));

-- news
DROP POLICY IF EXISTS "Editors can manage news" ON public.news;
CREATE POLICY "Editors can manage news" ON public.news
  FOR ALL TO authenticated
  USING (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'nyheter'::text, 'edit'::text))
  WITH CHECK (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'nyheter'::text, 'edit'::text));

DROP POLICY IF EXISTS "Editors can view all news" ON public.news;
CREATE POLICY "Editors can view all news" ON public.news
  FOR SELECT TO authenticated
  USING (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'nyheter'::text, 'edit'::text));

-- prompt_categories
DROP POLICY IF EXISTS "Editors can delete prompt categories" ON public.prompt_categories;
CREATE POLICY "Editors can delete prompt categories" ON public.prompt_categories
  FOR DELETE TO authenticated
  USING (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'prompts'::text, 'edit'::text));

DROP POLICY IF EXISTS "Editors can insert prompt categories" ON public.prompt_categories;
CREATE POLICY "Editors can insert prompt categories" ON public.prompt_categories
  FOR INSERT TO authenticated
  WITH CHECK (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'prompts'::text, 'edit'::text));

DROP POLICY IF EXISTS "Editors can update prompt categories" ON public.prompt_categories;
CREATE POLICY "Editors can update prompt categories" ON public.prompt_categories
  FOR UPDATE TO authenticated
  USING (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'prompts'::text, 'edit'::text))
  WITH CHECK (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'prompts'::text, 'edit'::text));

-- prompts
DROP POLICY IF EXISTS "Author or admin can delete prompts" ON public.prompts;
CREATE POLICY "Author or admin can delete prompts" ON public.prompts
  FOR DELETE TO authenticated
  USING ((auth.uid() = author_id) OR is_in_admin_group(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can create prompts" ON public.prompts;
CREATE POLICY "Authenticated can create prompts" ON public.prompts
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = author_id) AND (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'prompts'::text, 'view'::text) OR has_module_slug_permission(auth.uid(), 'prompts'::text, 'edit'::text)));

DROP POLICY IF EXISTS "Users with view access can view prompts" ON public.prompts;
CREATE POLICY "Users with view access can view prompts" ON public.prompts
  FOR SELECT TO authenticated
  USING (is_in_admin_group(auth.uid()) OR has_module_slug_permission(auth.uid(), 'prompts'::text, 'view'::text) OR has_module_slug_permission(auth.uid(), 'prompts'::text, 'edit'::text) OR has_module_slug_permission(auth.uid(), 'prompts'::text, 'owner'::text));
