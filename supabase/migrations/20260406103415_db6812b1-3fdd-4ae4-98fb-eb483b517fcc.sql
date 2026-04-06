-- Drop the old SELECT policy that only allowed viewing own read status
DROP POLICY IF EXISTS "Users can view own read status" ON public.chat_read_status;

-- Allow members of a channel to see all read statuses for that channel
CREATE POLICY "Members can view channel read status"
ON public.chat_read_status
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_channel_members m
    WHERE m.channel_id = chat_read_status.channel_id
      AND m.user_id = auth.uid()
  )
);