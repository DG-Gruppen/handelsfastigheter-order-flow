
-- Internal news articles table
CREATE TABLE public.news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Nyhet',
  emoji text NOT NULL DEFAULT '📰',
  is_pinned boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  author_id uuid NOT NULL,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- Everyone can read published news
CREATE POLICY "Authenticated can view published news"
  ON public.news FOR SELECT TO authenticated
  USING (is_published = true);

-- Editors can manage news (admin or module permission)
CREATE POLICY "Editors can manage news"
  ON public.news FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'nyheter'::text, 'edit'::text))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'nyheter'::text, 'edit'::text));

-- Editors can also view drafts
CREATE POLICY "Editors can view all news"
  ON public.news FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'nyheter'::text, 'edit'::text));

-- Updated_at trigger
CREATE TRIGGER set_news_updated_at
  BEFORE UPDATE ON public.news
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
