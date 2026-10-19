CREATE OR REPLACE FUNCTION public.index_kb_video()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.content_index WHERE source_table = 'kb_videos' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.is_published = true THEN
    INSERT INTO public.content_index (source_table, source_id, chunk_index, title, content, metadata, updated_at)
    VALUES ('kb_videos', NEW.id, 0, NEW.title, NEW.description,
            jsonb_build_object('tags', NEW.tags, 'video_url', NEW.video_url), now())
    ON CONFLICT (source_table, source_id, chunk_index)
    DO UPDATE SET title = excluded.title, content = excluded.content,
                  metadata = excluded.metadata, updated_at = now();
  ELSE
    DELETE FROM public.content_index WHERE source_table = 'kb_videos' AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.index_it_faq()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.content_index WHERE source_table = 'it_faq' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.is_active = true THEN
    INSERT INTO public.content_index (source_table, source_id, chunk_index, title, content, metadata, updated_at)
    VALUES ('it_faq', NEW.id, 0, NEW.question, NEW.answer, '{}'::jsonb, now())
    ON CONFLICT (source_table, source_id, chunk_index)
    DO UPDATE SET title = excluded.title, content = excluded.content, updated_at = now();
  ELSE
    DELETE FROM public.content_index WHERE source_table = 'it_faq' AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;