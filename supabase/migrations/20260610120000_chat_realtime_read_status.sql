-- The chat UI subscribes to chat_read_status (live read receipts / blue
-- checkmarks) and chat_channel_members (live membership changes), but these
-- tables were never added to the realtime publication so those subscriptions
-- never received any events. Add them, idempotently.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_read_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_read_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_channel_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channel_members;
  END IF;
END $$;
