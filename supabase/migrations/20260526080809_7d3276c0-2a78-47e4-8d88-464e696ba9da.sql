ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS heartpace_employee_id text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_heartpace_employee_id_key
  ON public.profiles (heartpace_employee_id)
  WHERE heartpace_employee_id IS NOT NULL;