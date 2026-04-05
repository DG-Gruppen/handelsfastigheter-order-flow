
-- Fix chat_channels SELECT: only members can see channels
DROP POLICY IF EXISTS "Anyone can view group channels" ON public.chat_channels;
DROP POLICY IF EXISTS "DM members can view DM channels" ON public.chat_channels;

CREATE POLICY "Members can view their channels"
ON public.chat_channels
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM public.chat_channel_members ccm
    WHERE ccm.channel_id = chat_channels.id
      AND ccm.user_id = auth.uid()
  )
);

-- Fix chat_messages INSERT: the old policy had m.channel_id = m.channel_id (always true)
DROP POLICY IF EXISTS "Members can send messages" ON public.chat_messages;

CREATE POLICY "Members can send messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.chat_channel_members m
    WHERE m.channel_id = chat_messages.channel_id
      AND m.user_id = auth.uid()
  )
);

-- Fix chat_messages SELECT: ensure member-based access
DROP POLICY IF EXISTS "Members can view channel messages" ON public.chat_messages;

CREATE POLICY "Members can view channel messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_channel_members m
    WHERE m.channel_id = chat_messages.channel_id
      AND m.user_id = auth.uid()
  )
);

-- Add unique constraint to prevent duplicate memberships
ALTER TABLE public.chat_channel_members
ADD CONSTRAINT chat_channel_members_channel_user_unique
UNIQUE (channel_id, user_id);
