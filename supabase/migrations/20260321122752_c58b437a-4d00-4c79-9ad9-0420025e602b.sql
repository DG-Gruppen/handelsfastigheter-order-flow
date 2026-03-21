
-- Trigger function: calls extract-document-text edge function via pg_net
-- when a supported file type is inserted or updated in document_files.
CREATE OR REPLACE FUNCTION public.notify_extract_document_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  -- Only process extractable file types
  IF NOT (
    NEW.mime_type LIKE 'text/%'
    OR NEW.mime_type = 'application/pdf'
    OR NEW.mime_type = 'application/json'
    OR NEW.mime_type = 'application/xml'
    OR NEW.mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    OR NEW.mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) THEN
    RETURN NEW;
  END IF;

  -- Read config from Supabase-provided settings
  _supabase_url := current_setting('app.settings.supabase_url', true);
  _anon_key     := current_setting('app.settings.supabase_anon_key', true);

  -- Fallback: skip extraction if config not available
  IF _supabase_url IS NULL OR _anon_key IS NULL THEN
    RAISE WARNING 'extract-document-text: missing app.settings, skipping';
    RETURN NEW;
  END IF;

  -- Fire-and-forget HTTP POST via pg_net
  PERFORM net.http_post(
    url     := _supabase_url || '/functions/v1/extract-document-text',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body    := jsonb_build_object(
      'record', jsonb_build_object(
        'id',           NEW.id,
        'storage_path', NEW.storage_path,
        'mime_type',    NEW.mime_type,
        'name',         NEW.name,
        'folder_id',    NEW.folder_id
      )
    )
  );

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_extract_document_text ON public.document_files;
CREATE TRIGGER trigger_extract_document_text
AFTER INSERT OR UPDATE ON public.document_files
FOR EACH ROW
EXECUTE FUNCTION public.notify_extract_document_text();
