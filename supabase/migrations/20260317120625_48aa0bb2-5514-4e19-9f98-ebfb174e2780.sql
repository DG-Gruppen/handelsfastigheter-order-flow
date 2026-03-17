
-- Planner boards
CREATE TABLE public.planner_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.planner_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view boards" ON public.planner_boards
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert boards" ON public.planner_boards
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins and IT can manage boards" ON public.planner_boards
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'it'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'it'::app_role));

-- Planner columns
CREATE TABLE public.planner_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.planner_boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  wip_limit integer DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planner_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view columns" ON public.planner_columns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and IT can manage columns" ON public.planner_columns
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'it'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'it'::app_role));

-- Planner cards
CREATE TABLE public.planner_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id uuid NOT NULL REFERENCES public.planner_columns(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.planner_boards(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assignee_id uuid DEFAULT NULL,
  reporter_id uuid NOT NULL,
  due_date date DEFAULT NULL,
  labels text[] DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planner_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cards" ON public.planner_cards
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert cards" ON public.planner_cards
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins and IT can manage cards" ON public.planner_cards
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'it'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'it'::app_role));

CREATE POLICY "Assignees can update their cards" ON public.planner_cards
  FOR UPDATE TO authenticated
  USING (auth.uid() = assignee_id OR auth.uid() = reporter_id);

-- Indexes
CREATE INDEX idx_planner_cards_column_id ON public.planner_cards(column_id);
CREATE INDEX idx_planner_cards_board_id ON public.planner_cards(board_id);
CREATE INDEX idx_planner_cards_assignee ON public.planner_cards(assignee_id);
CREATE INDEX idx_planner_columns_board_id ON public.planner_columns(board_id);

-- Updated_at triggers
CREATE TRIGGER update_planner_boards_updated_at BEFORE UPDATE ON public.planner_boards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_planner_cards_updated_at BEFORE UPDATE ON public.planner_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
