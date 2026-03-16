CREATE TABLE public.recognitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  icon text NOT NULL DEFAULT '⭐',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recognitions ENABLE ROW LEVEL SECURITY;

-- Everyone can view recognitions
CREATE POLICY "Authenticated users can view recognitions"
  ON public.recognitions FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create recognitions
CREATE POLICY "Authenticated users can create recognitions"
  ON public.recognitions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

-- Users can delete their own recognitions
CREATE POLICY "Users can delete own recognitions"
  ON public.recognitions FOR DELETE
  TO authenticated
  USING (auth.uid() = from_user_id);