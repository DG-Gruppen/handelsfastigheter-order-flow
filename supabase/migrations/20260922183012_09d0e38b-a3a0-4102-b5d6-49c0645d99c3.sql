CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions: egna enheter" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions: egna enheter"
ON public.push_subscriptions FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
  _url text;
BEGIN
  _supabase_url := current_setting('app.settings.supabase_url', true);
  _anon_key     := current_setting('app.settings.supabase_anon_key', true);

  IF _supabase_url IS NULL OR _anon_key IS NULL THEN
    RETURN NEW;
  END IF;

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
    url     := _supabase_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _anon_key,
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

DROP TRIGGER IF EXISTS notifications_push_trigger ON public.notifications;
CREATE TRIGGER notifications_push_trigger
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_notification();