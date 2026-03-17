-- Create a helper function to check module permissions by slug (for use in RLS policies)
CREATE OR REPLACE FUNCTION public.has_module_slug_permission(_user_id uuid, _slug text, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.module_permissions mp
    JOIN public.modules m ON m.id = mp.module_id
    WHERE m.slug = _slug AND mp.grantee_type = 'user' AND mp.grantee_id = _user_id
      AND CASE _permission
        WHEN 'view' THEN mp.can_view
        WHEN 'edit' THEN mp.can_edit
        WHEN 'delete' THEN mp.can_delete
        WHEN 'owner' THEN mp.is_owner
        ELSE false END
  ) OR EXISTS (
    SELECT 1 FROM public.module_permissions mp
    JOIN public.modules m ON m.id = mp.module_id
    JOIN public.group_members gm ON gm.group_id = mp.grantee_id
    WHERE m.slug = _slug AND mp.grantee_type = 'group' AND gm.user_id = _user_id
      AND CASE _permission
        WHEN 'view' THEN mp.can_view
        WHEN 'edit' THEN mp.can_edit
        WHEN 'delete' THEN mp.can_delete
        WHEN 'owner' THEN mp.is_owner
        ELSE false END
  )
$$;

-- Update planner_boards management policy
DROP POLICY IF EXISTS "Admins and IT can manage boards" ON public.planner_boards;
CREATE POLICY "Module permission or admin can manage boards" ON public.planner_boards
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'planner', 'edit'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'planner', 'edit'));

-- Update planner_columns management policy
DROP POLICY IF EXISTS "Admins and IT can manage columns" ON public.planner_columns;
CREATE POLICY "Module permission or admin can manage columns" ON public.planner_columns
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'planner', 'edit'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'planner', 'edit'));

-- Update planner_cards management policy
DROP POLICY IF EXISTS "Admins and IT can manage cards" ON public.planner_cards;
CREATE POLICY "Module permission or admin can manage cards" ON public.planner_cards
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'planner', 'edit'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'planner', 'edit'));

-- Update planner_card_comments delete policy
DROP POLICY IF EXISTS "Users can delete own or admin delete any" ON public.planner_card_comments;
CREATE POLICY "Users can delete own or editors delete any" ON public.planner_card_comments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'planner', 'edit'));

-- Update KB articles policies
DROP POLICY IF EXISTS "Admins can view all articles" ON public.kb_articles;
CREATE POLICY "Editors can view all articles" ON public.kb_articles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken', 'edit'));

DROP POLICY IF EXISTS "Admins can manage articles" ON public.kb_articles;
CREATE POLICY "Editors can manage articles" ON public.kb_articles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken', 'edit'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken', 'edit'));

-- Update KB videos policies
DROP POLICY IF EXISTS "Admins can view all videos" ON public.kb_videos;
CREATE POLICY "Editors can view all videos" ON public.kb_videos
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken', 'edit'));

DROP POLICY IF EXISTS "Admins can manage videos" ON public.kb_videos;
CREATE POLICY "Editors can manage videos" ON public.kb_videos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken', 'edit'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken', 'edit'));

-- Update KB categories policy
DROP POLICY IF EXISTS "Admins can manage kb_categories" ON public.kb_categories;
CREATE POLICY "Editors can manage kb_categories" ON public.kb_categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken', 'edit'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'kunskapsbanken', 'edit'));

-- Update IT FAQ policy
DROP POLICY IF EXISTS "Admins can manage FAQ" ON public.it_faq;
CREATE POLICY "Editors can manage FAQ" ON public.it_faq
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'it-support', 'edit'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'it-support', 'edit'));

-- Update tools policy  
DROP POLICY IF EXISTS "Admins can manage tools" ON public.tools;
CREATE POLICY "Editors can manage tools" ON public.tools
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'tools', 'edit'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'tools', 'edit'));