
-- 1) Drop the overly permissive anon SELECT policy that allowed full enumeration
DROP POLICY IF EXISTS "Anyone can read invites by token" ON public.external_invites;

-- 2) Provide a SECURITY DEFINER lookup that only returns rows on exact token match
CREATE OR REPLACE FUNCTION public.get_external_invite_by_token(_token text)
RETURNS TABLE (
  email text,
  company_name text,
  expires_at timestamptz,
  accepted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ei.email, ei.company_name, ei.expires_at, ei.accepted_at
  FROM public.external_invites ei
  WHERE _token IS NOT NULL
    AND length(_token) >= 32
    AND ei.token = _token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_external_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_external_invite_by_token(text) TO anon, authenticated;
