
-- Add is_external flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false;

-- Create external_invites table
CREATE TABLE public.external_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid NOT NULL,
  group_ids uuid[] NOT NULL DEFAULT '{}',
  module_slugs text[] NOT NULL DEFAULT '{}',
  company_name text NOT NULL DEFAULT '',
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.external_invites ENABLE ROW LEVEL SECURITY;

-- Admins can manage invites
CREATE POLICY "Admins can manage external invites"
  ON public.external_invites
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role can update (for edge function)
CREATE POLICY "Service role can manage external invites"
  ON public.external_invites
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anonymous SELECT for invite validation (token lookup)
CREATE POLICY "Anyone can read invites by token"
  ON public.external_invites
  FOR SELECT
  TO anon
  USING (true);

-- Index on token for fast lookups
CREATE INDEX idx_external_invites_token ON public.external_invites (token);
