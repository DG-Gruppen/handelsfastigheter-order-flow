
-- Trigger: notify when a card is assigned or reassigned
CREATE OR REPLACE FUNCTION public.notify_planner_card_assigned()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _card_title text;
  _assigner_name text;
BEGIN
  -- Only fire when assignee_id changes to a non-null value different from the actor
  IF NEW.assignee_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id THEN RETURN NEW; END IF;
  -- Don't notify if user assigned themselves
  IF NEW.assignee_id = auth.uid() THEN RETURN NEW; END IF;

  SELECT full_name INTO _assigner_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  PERFORM public.create_notification(
    NEW.assignee_id,
    'Tilldelad kort',
    COALESCE(_assigner_name, 'Någon') || ' tilldelade dig kortet "' || NEW.title || '"',
    'planner_assigned',
    NEW.id
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_notify_planner_card_assigned
  AFTER INSERT OR UPDATE OF assignee_id ON public.planner_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_planner_card_assigned();

-- Trigger: notify card creator and assignee when a comment is added
CREATE OR REPLACE FUNCTION public.notify_planner_card_comment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _card record;
  _commenter_name text;
  _notify_user_id uuid;
BEGIN
  SELECT id, title, reporter_id, assignee_id INTO _card
  FROM public.planner_cards WHERE id = NEW.card_id;

  IF _card IS NULL THEN RETURN NEW; END IF;

  SELECT full_name INTO _commenter_name FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;

  -- Notify reporter (card creator) if they didn't write the comment
  IF _card.reporter_id IS NOT NULL AND _card.reporter_id != NEW.user_id THEN
    PERFORM public.create_notification(
      _card.reporter_id,
      'Ny kommentar',
      COALESCE(_commenter_name, 'Någon') || ' kommenterade på "' || _card.title || '"',
      'planner_comment',
      _card.id
    );
  END IF;

  -- Notify assignee if different from reporter and commenter
  IF _card.assignee_id IS NOT NULL
     AND _card.assignee_id != NEW.user_id
     AND _card.assignee_id IS DISTINCT FROM _card.reporter_id THEN
    PERFORM public.create_notification(
      _card.assignee_id,
      'Ny kommentar',
      COALESCE(_commenter_name, 'Någon') || ' kommenterade på "' || _card.title || '"',
      'planner_comment',
      _card.id
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_notify_planner_card_comment
  AFTER INSERT ON public.planner_card_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_planner_card_comment();
