
-- Attachments for planner cards
CREATE TABLE public.planner_card_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id uuid NOT NULL REFERENCES public.planner_cards(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.planner_card_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view attachments"
  ON public.planner_card_attachments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert attachments"
  ON public.planner_card_attachments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploader or editors can delete attachments"
  ON public.planner_card_attachments FOR DELETE
  TO authenticated USING (
    auth.uid() = uploaded_by
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_module_slug_permission(auth.uid(), 'planner'::text, 'edit'::text)
  );
