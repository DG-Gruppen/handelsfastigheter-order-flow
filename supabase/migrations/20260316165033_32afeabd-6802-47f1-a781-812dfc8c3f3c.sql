
-- Knowledge base categories
CREATE TABLE public.kb_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT 'folder',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kb_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active kb_categories" ON public.kb_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage kb_categories" ON public.kb_categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Knowledge base articles
CREATE TABLE public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL,
  content text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  category_id uuid REFERENCES public.kb_categories(id) ON DELETE SET NULL,
  tags text[] DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  author_id uuid NOT NULL,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view published articles" ON public.kb_articles
  FOR SELECT TO authenticated USING (is_published = true);

CREATE POLICY "Admins can view all articles" ON public.kb_articles
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage articles" ON public.kb_articles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Knowledge base videos
CREATE TABLE public.kb_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  video_url text NOT NULL,
  thumbnail_url text DEFAULT NULL,
  category_id uuid REFERENCES public.kb_categories(id) ON DELETE SET NULL,
  tags text[] DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  author_id uuid NOT NULL,
  views integer NOT NULL DEFAULT 0,
  duration_seconds integer DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kb_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view published videos" ON public.kb_videos
  FOR SELECT TO authenticated USING (is_published = true);

CREATE POLICY "Admins can view all videos" ON public.kb_videos
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage videos" ON public.kb_videos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_kb_articles_updated_at
  BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_videos_updated_at
  BEFORE UPDATE ON public.kb_videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
