
-- A) Backfill missing internal users
INSERT INTO public.chat_channel_members (channel_id, user_id)
SELECT c.id, p.user_id
FROM public.chat_channels c
CROSS JOIN public.profiles p
WHERE c.name = 'Anställda'
  AND p.is_external = false
  AND coalesce(p.is_hidden, false) = false
  AND NOT EXISTS (
    SELECT 1 FROM public.chat_channel_members m
    WHERE m.channel_id = c.id AND m.user_id = p.user_id
  );

-- B) Trigger: auto-add new internal profiles to "Anställda"
CREATE OR REPLACE FUNCTION public.add_internal_user_to_anstallda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel_id uuid;
  v_was_internal boolean;
  v_is_internal boolean;
BEGIN
  v_is_internal := COALESCE(NEW.is_external, false) = false
                   AND COALESCE(NEW.is_hidden, false) = false;

  IF TG_OP = 'UPDATE' THEN
    v_was_internal := COALESCE(OLD.is_external, false) = false
                      AND COALESCE(OLD.is_hidden, false) = false;
    IF v_was_internal = v_is_internal THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NOT v_is_internal THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_channel_id
  FROM public.chat_channels
  WHERE name = 'Anställda'
  LIMIT 1;

  IF v_channel_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.chat_channel_members (channel_id, user_id)
  VALUES (v_channel_id, NEW.user_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_internal_user_to_anstallda_ins ON public.profiles;
CREATE TRIGGER trg_add_internal_user_to_anstallda_ins
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.add_internal_user_to_anstallda();

DROP TRIGGER IF EXISTS trg_add_internal_user_to_anstallda_upd ON public.profiles;
CREATE TRIGGER trg_add_internal_user_to_anstallda_upd
AFTER UPDATE OF is_external, is_hidden ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.add_internal_user_to_anstallda();
