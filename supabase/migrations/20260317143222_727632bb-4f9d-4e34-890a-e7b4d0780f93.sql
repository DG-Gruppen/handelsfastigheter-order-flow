-- Allow service_role to delete notifications (for cleanup function)
CREATE POLICY "Service role can delete notifications"
ON public.notifications
FOR DELETE
TO service_role
USING (true);
