
-- 1) chat_reactions: restrict SELECT to channel members
DROP POLICY IF EXISTS "Authenticated can view reactions" ON public.chat_reactions;

CREATE POLICY "Members can view channel reactions"
ON public.chat_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_messages msg
    JOIN public.chat_channel_members m
      ON m.channel_id = msg.channel_id
    WHERE msg.id = chat_reactions.message_id
      AND m.user_id = auth.uid()
  )
);

-- 2) onboarding_tasks: prevent nearest manager from reading is_sensitive tasks
DROP POLICY IF EXISTS "Narmaste chef ser uppgifter pa sina instanser" ON public.onboarding_tasks;

CREATE POLICY "Narmaste chef ser uppgifter pa sina instanser"
ON public.onboarding_tasks
FOR SELECT
TO authenticated
USING (
  is_nearest_manager_for_instance(auth.uid(), instance_id)
  AND COALESCE(is_sensitive, false) = false
);
