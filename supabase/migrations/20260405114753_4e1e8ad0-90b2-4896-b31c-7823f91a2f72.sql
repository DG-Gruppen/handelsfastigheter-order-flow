-- Fix INSERT policy: allow channel creator to add members
DROP POLICY IF EXISTS "Users can join channels" ON public.chat_channel_members;

CREATE POLICY "Users can join channels"
ON public.chat_channel_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.chat_channels c
    WHERE c.id = chat_channel_members.channel_id
      AND c.created_by = auth.uid()
  )
);

-- Fix DELETE policy: allow channel creator to remove members
DROP POLICY IF EXISTS "Users can leave channels" ON public.chat_channel_members;

CREATE POLICY "Users can leave channels"
ON public.chat_channel_members
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.chat_channels c
    WHERE c.id = chat_channel_members.channel_id
      AND c.created_by = auth.uid()
  )
);