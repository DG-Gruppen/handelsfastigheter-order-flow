CREATE OR REPLACE FUNCTION public.index_tools()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.content_index WHERE source_table = 'tools' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.is_active = true THEN
    INSERT INTO public.content_index (source_table, source_id, chunk_index, title, content, metadata, updated_at)
    VALUES ('tools', NEW.id, 0, NEW.name, NEW.description,
            jsonb_build_object('url', NEW.url, 'emoji', NEW.emoji), now())
    ON CONFLICT (source_table, source_id, chunk_index)
    DO UPDATE SET title = excluded.title, content = excluded.content,
                  metadata = excluded.metadata, updated_at = now();
  ELSE
    DELETE FROM public.content_index WHERE source_table = 'tools' AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;