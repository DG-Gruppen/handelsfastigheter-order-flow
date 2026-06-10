CREATE OR REPLACE FUNCTION public.index_department()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.content_index WHERE source_table = 'departments' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.content_index (source_table, source_id, chunk_index, title, content, metadata, updated_at)
  VALUES ('departments', NEW.id, 0, NEW.name,
          'Avdelning: ' || NEW.name,
          jsonb_build_object('color', NEW.color, 'parent_id', NEW.parent_id), now())
  ON CONFLICT (source_table, source_id, chunk_index)
  DO UPDATE SET title = excluded.title, content = excluded.content,
                metadata = excluded.metadata, updated_at = now();
  RETURN NEW;
END;
$function$;