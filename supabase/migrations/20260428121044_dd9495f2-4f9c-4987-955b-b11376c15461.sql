
-- Prompt library tables
CREATE TABLE public.prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Övrigt',
  variables text[] NOT NULL DEFAULT '{}',
  copy_count integer NOT NULL DEFAULT 0,
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with view access can view prompts"
ON public.prompts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_module_slug_permission(auth.uid(), 'prompts', 'view')
  OR has_module_slug_permission(auth.uid(), 'prompts', 'edit')
  OR has_module_slug_permission(auth.uid(), 'prompts', 'owner')
);

CREATE POLICY "Authenticated can create prompts"
ON public.prompts FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_module_slug_permission(auth.uid(), 'prompts', 'view')
    OR has_module_slug_permission(auth.uid(), 'prompts', 'edit')
  )
);

CREATE POLICY "Author or admin can update prompts"
ON public.prompts FOR UPDATE TO authenticated
USING (
  auth.uid() = author_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_module_slug_permission(auth.uid(), 'prompts', 'edit')
);

CREATE POLICY "Author or admin can delete prompts"
ON public.prompts FOR DELETE TO authenticated
USING (
  auth.uid() = author_id
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE TRIGGER prompts_updated_at
BEFORE UPDATE ON public.prompts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX prompts_category_idx ON public.prompts(category);
CREATE INDEX prompts_author_idx ON public.prompts(author_id);

-- Ratings (1-5 stars, one per user per prompt)
CREATE TABLE public.prompt_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prompt_id, user_id)
);

ALTER TABLE public.prompt_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ratings"
ON public.prompt_ratings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage own ratings"
ON public.prompt_ratings FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER prompt_ratings_updated_at
BEFORE UPDATE ON public.prompt_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Edit suggestions (anyone can suggest, author/admin reviews)
CREATE TABLE public.prompt_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  suggested_by uuid NOT NULL,
  suggested_title text,
  suggested_description text,
  suggested_body text,
  suggested_category text,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prompt_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suggester author or admin can view suggestions"
ON public.prompt_suggestions FOR SELECT TO authenticated
USING (
  auth.uid() = suggested_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.prompts p WHERE p.id = prompt_id AND p.author_id = auth.uid())
);

CREATE POLICY "Authenticated can create suggestions"
ON public.prompt_suggestions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = suggested_by);

CREATE POLICY "Author or admin can update suggestions"
ON public.prompt_suggestions FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.prompts p WHERE p.id = prompt_id AND p.author_id = auth.uid())
);

-- Atomic copy counter
CREATE OR REPLACE FUNCTION public.increment_prompt_copy(_prompt_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.prompts SET copy_count = copy_count + 1 WHERE id = _prompt_id;
$$;

-- Register module
INSERT INTO public.modules (name, slug, route, icon, description, sort_order, is_active)
VALUES ('Prompt-bibliotek', 'prompts', '/prompts', 'sparkles', 'Sparade AI-prompts som kollegorna kan dela och använda', 65, true)
ON CONFLICT DO NOTHING;
