CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _url text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  _url := CASE
    WHEN NEW.type LIKE 'order_%' AND NEW.reference_id IS NOT NULL THEN '/orders/' || NEW.reference_id
    WHEN NEW.type LIKE 'order_%' THEN '/history'
    WHEN NEW.type = 'document_new' THEN '/documents'
    WHEN NEW.type LIKE 'kb_%' THEN '/kunskapsbanken'
    WHEN NEW.type LIKE 'planner_%' THEN '/planner'
    ELSE '/dashboard'
  END;

  PERFORM net.http_post(
    url     := 'https://zafzwayqhlnxpsumfjps.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-push-secret', '51998568cf5224ac8f71aee8160c7aa7cbcab954a4da05c0'
    ),
    body    := jsonb_build_object(
      'user_id', NEW.user_id,
      'title',   NEW.title,
      'body',    COALESCE(NEW.message, ''),
      'url',     _url,
      'tag',     NEW.id::text
    )
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_push_on_notification() FROM anon, authenticated, public;