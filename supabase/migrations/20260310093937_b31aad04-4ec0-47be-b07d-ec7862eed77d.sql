
-- Improve handle_new_user: delete orphan seed profile if email matches, then merge
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_profile_id uuid;
BEGIN
  -- Find existing profile with matching email but different user_id
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE email = COALESCE(NEW.email, '')
    AND user_id != NEW.id
  LIMIT 1;

  IF existing_profile_id IS NOT NULL THEN
    -- Update existing profile to link to this auth user
    UPDATE public.profiles
    SET user_id = NEW.id,
        full_name = COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NULLIF(NEW.raw_user_meta_data->>'name', ''), full_name),
        updated_at = now()
    WHERE id = existing_profile_id;
  ELSIF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
    -- No existing profile at all, create new
    INSERT INTO public.profiles (user_id, full_name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
      COALESCE(NEW.email, '')
    );
  END IF;
  RETURN NEW;
END;
$function$;
