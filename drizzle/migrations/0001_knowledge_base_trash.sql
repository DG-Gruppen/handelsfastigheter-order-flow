CREATE TABLE public.kb_trash (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL CHECK (source_table IN ('kb_articles','kb_videos','kb_categories')),
  source_id uuid NOT NULL,
  title text NOT NULL,
  payload jsonb NOT NULL,
  deleted_by uuid,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 days')
);
GRANT SELECT ON public.kb_trash TO authenticated;
GRANT ALL ON public.kb_trash TO service_role;
ALTER TABLE public.kb_trash ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Knowledge editors can read unexpired trash" ON public.kb_trash FOR SELECT TO authenticated
USING (expires_at > now() AND (public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'kunskapsbanken', 'edit')));
CREATE INDEX kb_trash_expiry_idx ON public.kb_trash(expires_at);

CREATE OR REPLACE FUNCTION public.archive_kb_deleted_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'kb_categories' AND (
    EXISTS (SELECT 1 FROM public.kb_articles WHERE category_id = OLD.id) OR
    EXISTS (SELECT 1 FROM public.kb_videos WHERE category_id = OLD.id)
  ) THEN
    RAISE EXCEPTION 'Kategorin används. Flytta artiklar och videor till en annan kategori innan du raderar den.';
  END IF;
  INSERT INTO public.kb_trash (source_table, source_id, title, payload, deleted_by)
  VALUES (TG_TABLE_NAME, OLD.id, COALESCE(to_jsonb(OLD)->>'title', to_jsonb(OLD)->>'name'), to_jsonb(OLD), auth.uid());
  RETURN OLD;
END;
$$;
CREATE TRIGGER archive_kb_article BEFORE DELETE ON public.kb_articles FOR EACH ROW EXECUTE FUNCTION public.archive_kb_deleted_row();
CREATE TRIGGER archive_kb_video BEFORE DELETE ON public.kb_videos FOR EACH ROW EXECUTE FUNCTION public.archive_kb_deleted_row();
CREATE TRIGGER archive_kb_category BEFORE DELETE ON public.kb_categories FOR EACH ROW EXECUTE FUNCTION public.archive_kb_deleted_row();

CREATE OR REPLACE FUNCTION public.restore_kb_trash(_trash_id uuid)
RETURNS TABLE(id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item public.kb_trash%ROWTYPE;
  restored_payload jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'kunskapsbanken', 'edit')) THEN
    RAISE EXCEPTION 'Du saknar behörighet att återställa innehåll.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO item FROM public.kb_trash t WHERE t.id = _trash_id FOR UPDATE;
  IF NOT FOUND OR item.expires_at <= now() THEN
    RAISE EXCEPTION 'Innehållet finns inte längre i papperskorgen.';
  END IF;
  restored_payload := item.payload;
  IF item.source_table IN ('kb_articles', 'kb_videos') THEN
    restored_payload := restored_payload || jsonb_build_object('is_published', false);
    IF restored_payload->>'category_id' IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.kb_categories WHERE kb_categories.id = (restored_payload->>'category_id')::uuid
    ) THEN
      restored_payload := restored_payload || jsonb_build_object('category_id', NULL);
    END IF;
  END IF;
  CASE item.source_table
    WHEN 'kb_articles' THEN
      INSERT INTO public.kb_articles SELECT (jsonb_populate_record(NULL::public.kb_articles, restored_payload)).*;
    WHEN 'kb_videos' THEN
      INSERT INTO public.kb_videos SELECT (jsonb_populate_record(NULL::public.kb_videos, restored_payload)).*;
    WHEN 'kb_categories' THEN
      INSERT INTO public.kb_categories SELECT (jsonb_populate_record(NULL::public.kb_categories, restored_payload)).*;
    ELSE RAISE EXCEPTION 'Ogiltig innehållstyp.';
  END CASE;
  DELETE FROM public.kb_trash WHERE kb_trash.id = _trash_id;
  RETURN QUERY SELECT item.source_id;
END;
$$;
REVOKE ALL ON FUNCTION public.restore_kb_trash(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_kb_trash(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.archive_kb_deleted_row() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('purge-expired-kb-trash', '15 2 * * *', $job$DELETE FROM public.kb_trash WHERE expires_at <= now();$job$);