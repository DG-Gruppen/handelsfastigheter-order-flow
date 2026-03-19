
CREATE TABLE public.password_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  password_id uuid NOT NULL REFERENCES public.shared_passwords(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL DEFAULT 'viewed',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.password_access_log ENABLE ROW LEVEL SECURITY;

-- Only admin/IT can view the log
CREATE POLICY "Admins and IT can view access log"
  ON public.password_access_log FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'it'::app_role)
  );

-- Any authenticated user can insert their own log entries
CREATE POLICY "Users can log own access"
  ON public.password_access_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
