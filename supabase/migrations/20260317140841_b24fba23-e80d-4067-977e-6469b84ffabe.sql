
CREATE TABLE public.planner_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.planner_boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_planner_activity_board ON public.planner_activity_log(board_id, created_at DESC);

ALTER TABLE public.planner_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view board activity"
  ON public.planner_activity_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert own activity"
  ON public.planner_activity_log FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
