CREATE TABLE public.celebration_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key text NOT NULL,
  user_id uuid NOT NULL,
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.celebration_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view" ON public.celebration_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert own" ON public.celebration_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own" ON public.celebration_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_celebration_comments_week_key ON public.celebration_comments (week_key);