import { supabase } from "@/integrations/supabase/client";

/**
 * Enqueues an email through pgmq instead of calling send-email directly.
 * This ensures retry/DLQ behaviour per Domain Rules Global Invariant #4.
 */
export async function enqueueEmail(params: {
  to: string;
  subject: string;
  html: string;
  reply_to?: string;
}) {
  const { error } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.reply_to ? { reply_to: params.reply_to } : {}),
    },
  });
  if (error) {
    console.error("Failed to enqueue email:", error);
    throw error;
  }
}
