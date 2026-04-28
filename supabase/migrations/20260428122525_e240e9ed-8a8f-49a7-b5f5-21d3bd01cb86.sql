CREATE TABLE public.prompt_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  badge_class text NOT NULL DEFAULT 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prompt_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view prompt categories"
ON public.prompt_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors can insert prompt categories"
ON public.prompt_categories FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'prompts', 'edit'));

CREATE POLICY "Editors can update prompt categories"
ON public.prompt_categories FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'prompts', 'edit'));

CREATE POLICY "Editors can delete prompt categories"
ON public.prompt_categories FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_module_slug_permission(auth.uid(), 'prompts', 'edit'));

CREATE TRIGGER prompt_categories_updated_at
BEFORE UPDATE ON public.prompt_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.prompt_categories (name, badge_class, sort_order) VALUES
  ('Avtal', 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200', 10),
  ('Ekonomi', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200', 20),
  ('Hållbarhet/Energi', 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200', 30),
  ('Marknadsföring', 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200', 40),
  ('Teknik', 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200', 50),
  ('Uthyrning', 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200', 60),
  ('Övrigt', 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', 70);