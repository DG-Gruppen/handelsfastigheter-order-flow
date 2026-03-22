
-- Create integration status enum
CREATE TYPE public.integration_status_level AS ENUM ('ok', 'warning', 'error');

-- Create integration_status table
CREATE TABLE public.integration_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  status integration_status_level NOT NULL DEFAULT 'ok',
  last_sync_at timestamptz,
  last_error text,
  error_count integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integration_status ENABLE ROW LEVEL SECURITY;

-- Admin/IT can read
CREATE POLICY "Admin and IT can view integrations"
  ON public.integration_status FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'it'));

-- Service role can manage (for edge functions)
CREATE POLICY "Service role can manage integrations"
  ON public.integration_status FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Seed initial rows for known integrations
INSERT INTO public.integration_status (slug, name) VALUES
  ('cision-feed', 'Cision Nyhetsflöde'),
  ('email-queue', 'E-post (Resend)'),
  ('ai-chat', 'AI-chatt'),
  ('content-index', 'Sökindex / Scraping'),
  ('document-extract', 'Dokumentextraktion');
