
-- Add due_done boolean to planner_cards
ALTER TABLE public.planner_cards ADD COLUMN due_done boolean NOT NULL DEFAULT false;

-- Create checklists table
CREATE TABLE public.planner_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.planner_cards(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Checklista',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.planner_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view checklists" ON public.planner_checklists
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert checklists" ON public.planner_checklists
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update checklists" ON public.planner_checklists
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete checklists" ON public.planner_checklists
  FOR DELETE TO authenticated USING (true);

-- Create checklist items table
CREATE TABLE public.planner_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.planner_checklists(id) ON DELETE CASCADE,
  text text NOT NULL DEFAULT '',
  checked boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.planner_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view checklist items" ON public.planner_checklist_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert checklist items" ON public.planner_checklist_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update checklist items" ON public.planner_checklist_items
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete checklist items" ON public.planner_checklist_items
  FOR DELETE TO authenticated USING (true);

-- Enable realtime for checklists
ALTER PUBLICATION supabase_realtime ADD TABLE public.planner_checklists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.planner_checklist_items;
