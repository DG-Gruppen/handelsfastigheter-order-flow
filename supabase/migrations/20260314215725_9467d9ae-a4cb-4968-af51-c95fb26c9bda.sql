
-- Create a security definer function to safely insert notifications
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid,
  _title text,
  _message text DEFAULT '',
  _type text DEFAULT 'info',
  _reference_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, reference_id)
  VALUES (_user_id, _title, _message, _type, _reference_id)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

-- Add a restrictive INSERT policy (only service_role can insert directly)
CREATE POLICY "Only service role can insert notifications directly"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (true);
