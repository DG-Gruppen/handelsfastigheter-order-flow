
CREATE TABLE public.tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  emoji text NOT NULL DEFAULT '🔗',
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active tools"
  ON public.tools FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage tools"
  ON public.tools FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.tools (name, description, emoji, url, sort_order) VALUES
  ('Vitec', 'Fastighetssystem', '🏠', 'https://fsab-handelsfastigheter.vitec.net/', 0),
  ('Vyer', 'Fastighetsvisning', '👁️', 'https://app.vyer.com/sites', 1),
  ('Zendesk', 'Ärendehantering & support', '🎧', 'https://lsthsvenskahandelsfastigheter.zendesk.com/hc/sv', 2),
  ('Rillion', 'Fakturahantering', '🧾', 'https://p29254x03.rillionprime.com/', 3),
  ('ViaEstate', 'Fastighetsdata & analys', '🏢', 'https://viaestate.viametrics.com/login', 4),
  ('Momentum', 'Underhållssystem', '🔧', 'https://rc.momentum.se/', 5),
  ('Metry', 'Energiuppföljning', '⚡', 'https://app.metry.io/', 6),
  ('SHF Webb', 'handelsfastigheter.se', '🌐', 'https://handelsfastigheter.se/', 7),
  ('Microsoft 365', 'Teams, Outlook, SharePoint', '💼', 'https://office.com', 8),
  ('Power BI', 'Rapportering & Analys', '📈', 'https://app.powerbi.com', 9),
  ('DocuSign', 'E-signering av avtal', '✍️', 'https://docusign.com', 10),
  ('Cision News', 'Pressmeddelanden', '📋', 'https://news.cision.com/se/svenska-handelsfastigheter', 11),
  ('Google Drive', 'Delade dokument', '🗂️', 'https://drive.google.com', 12);
