
CREATE TABLE public.planner_card_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.planner_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planner_card_comments ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view comments
CREATE POLICY "Authenticated can view comments"
  ON public.planner_card_comments FOR SELECT TO authenticated
  USING (true);

-- Users can insert their own comments
CREATE POLICY "Users can insert own comments"
  ON public.planner_card_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments, admins/IT can delete any
CREATE POLICY "Users can delete own or admin delete any"
  ON public.planner_card_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'it'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.planner_card_comments;
