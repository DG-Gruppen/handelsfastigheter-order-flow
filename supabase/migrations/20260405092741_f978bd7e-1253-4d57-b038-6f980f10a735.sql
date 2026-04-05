
-- Function to create a DM channel and add both members atomically
CREATE OR REPLACE FUNCTION public.create_dm_channel(_target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid;
  _existing_channel_id uuid;
  _new_channel_id uuid;
  _target_name text;
BEGIN
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _caller_id = _target_user_id THEN
    RAISE EXCEPTION 'Cannot DM yourself';
  END IF;

  -- Check if DM already exists between these two users
  SELECT cm1.channel_id INTO _existing_channel_id
  FROM public.chat_channel_members cm1
  JOIN public.chat_channel_members cm2 ON cm1.channel_id = cm2.channel_id
  JOIN public.chat_channels c ON c.id = cm1.channel_id
  WHERE cm1.user_id = _caller_id
    AND cm2.user_id = _target_user_id
    AND c.type = 'dm'
  LIMIT 1;

  IF _existing_channel_id IS NOT NULL THEN
    RETURN _existing_channel_id;
  END IF;

  -- Get target user name
  SELECT full_name INTO _target_name FROM public.profiles WHERE user_id = _target_user_id LIMIT 1;

  -- Create channel
  INSERT INTO public.chat_channels (name, type, created_by)
  VALUES (COALESCE(_target_name, 'DM'), 'dm', _caller_id)
  RETURNING id INTO _new_channel_id;

  -- Add both members
  INSERT INTO public.chat_channel_members (channel_id, user_id) VALUES
    (_new_channel_id, _caller_id),
    (_new_channel_id, _target_user_id);

  RETURN _new_channel_id;
END;
$$;
