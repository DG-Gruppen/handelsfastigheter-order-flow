
-- Search log table for tracking anonymous search queries
CREATE TABLE public.search_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_text text NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'search',
  session_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.search_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert search log"
  ON public.search_log FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin and IT can view search log"
  ON public.search_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'it'::app_role));

-- Index for time-based queries
CREATE INDEX idx_search_log_created_at ON public.search_log (created_at DESC);

-- Anonymous chat stats function (bypasses RLS on chat tables)
CREATE OR REPLACE FUNCTION public.get_anonymous_chat_stats(_since timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only admin/IT can call this
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'it'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_messages', (SELECT count(*) FROM chat_messages WHERE created_at >= _since),
    'active_channels', (SELECT count(DISTINCT channel_id) FROM chat_messages WHERE created_at >= _since),
    'total_reactions', (SELECT count(*) FROM chat_reactions WHERE created_at >= _since),
    'unique_chatters', (SELECT count(DISTINCT user_id) FROM chat_messages WHERE created_at >= _since),
    'thread_messages', (SELECT count(*) FROM chat_messages WHERE created_at >= _since AND parent_message_id IS NOT NULL),
    'messages_per_day', (
      SELECT jsonb_agg(row_to_json(d) ORDER BY d.day)
      FROM (
        SELECT created_at::date AS day, count(*) AS count
        FROM chat_messages
        WHERE created_at >= _since
        GROUP BY created_at::date
      ) d
    ),
    'top_channels', (
      SELECT jsonb_agg(row_to_json(c) ORDER BY c.msg_count DESC)
      FROM (
        SELECT ch.name, count(cm.id) AS msg_count
        FROM chat_messages cm
        JOIN chat_channels ch ON ch.id = cm.channel_id
        WHERE cm.created_at >= _since
        GROUP BY ch.name
        ORDER BY msg_count DESC
        LIMIT 10
      ) c
    )
  ) INTO result;

  RETURN result;
END;
$$;
