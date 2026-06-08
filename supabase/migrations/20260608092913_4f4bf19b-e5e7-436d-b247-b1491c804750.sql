
CREATE TABLE public.supermalet_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_name text NOT NULL,
  first_name text NOT NULL,
  personal_number text NOT NULL,
  passport_number text NOT NULL,
  nationality text NOT NULL,
  issued_date date NOT NULL,
  valid_until date NOT NULL,
  birth_place text NOT NULL,
  allergies text,
  passport_file_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supermalet_registrations TO authenticated;
GRANT ALL ON public.supermalet_registrations TO service_role;

ALTER TABLE public.supermalet_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own registration"
  ON public.supermalet_registrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own registration"
  ON public.supermalet_registrations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_in_admin_group(auth.uid())
    OR public.has_role(auth.uid(), 'it'::app_role)
  );

CREATE POLICY "Users can update own registration"
  ON public.supermalet_registrations FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_in_admin_group(auth.uid())
    OR public.has_role(auth.uid(), 'it'::app_role)
  );

CREATE POLICY "Admins can delete registrations"
  ON public.supermalet_registrations FOR DELETE
  TO authenticated
  USING (
    public.is_in_admin_group(auth.uid())
    OR public.has_role(auth.uid(), 'it'::app_role)
  );

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.supermalet_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
