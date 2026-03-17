
CREATE TABLE public.ceo_blog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT '',
  period text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ceo_blog ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Authenticated can view ceo blog"
  ON public.ceo_blog FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage ceo blog"
  ON public.ceo_blog FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed with current content
INSERT INTO public.ceo_blog (title, excerpt, author, period)
VALUES (
  'Reflektioner efter ett rekordår',
  '2025 blev vårt starkaste år. Men det som gör mig mest stolt är inte siffrorna – det är hur vi nådde dit. Varje hyresförhandling, varje energimätning, varje felanmälan som hanterades inom 24 timmar. Det är ni som bygger SHF:s framgång. Tack.',
  'Thomas Holm',
  'Q4 2025'
);
