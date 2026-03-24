CREATE OR REPLACE FUNCTION public.index_document_file()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.content_index
    WHERE source_table = 'document_files' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.content_index (
    source_table,
    source_id,
    chunk_index,
    title,
    content,
    metadata,
    updated_at
  )
  VALUES (
    'document_files',
    NEW.id,
    0,
    NEW.name,
    'Dokument "' || NEW.name || '" (typ: ' || NEW.mime_type || ')',
    jsonb_build_object('folder_id', NEW.folder_id, 'mime_type', NEW.mime_type),
    now()
  )
  ON CONFLICT (source_table, source_id, chunk_index)
  DO UPDATE SET
    title = excluded.title,
    content = excluded.content,
    metadata = excluded.metadata,
    updated_at = now();

  RETURN NEW;
END;
$function$;