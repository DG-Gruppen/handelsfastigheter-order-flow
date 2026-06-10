
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS heartpace_sync_excluded boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET department = 'IT/Support',
    heartpace_sync_excluded = true
WHERE email IN (
  'anders.larsson@dggruppen.se',
  'support@handelsfastigheter.se',
  'toni@kazarian.se'
);

UPDATE public.profiles
SET heartpace_sync_excluded = true
WHERE is_external = true;
