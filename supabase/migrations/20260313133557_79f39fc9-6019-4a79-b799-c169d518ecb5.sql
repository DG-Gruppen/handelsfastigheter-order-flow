
-- FAQ items for IT info page
CREATE TABLE public.it_faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.it_faq ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active FAQ" ON public.it_faq
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage FAQ" ON public.it_faq
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'it'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'it'::app_role));

-- Seed some example FAQ
INSERT INTO public.it_faq (question, answer, sort_order) VALUES
  ('Hur återställer jag mitt lösenord?', 'Klicka på "Glömt lösenord" på inloggningssidan eller kontakta IT-avdelningen så hjälper vi dig.', 1),
  ('Hur ansluter jag till VPN?', 'Installera VPN-klienten från Programcenter och logga in med dina vanliga uppgifter. Kontakta IT om du behöver hjälp med installationen.', 2),
  ('Hur beställer jag ny utrustning?', 'Gå till "Ny beställning" i menyn och välj den utrustning du behöver. Din chef attesterar beställningen.', 3),
  ('Hur får jag fjärrhjälp?', 'Klicka på fjärrhjälpslänken i menyn eller på denna sida. IT-avdelningen kan då ansluta till din dator och hjälpa dig.', 4);
