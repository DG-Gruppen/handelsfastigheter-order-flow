import { supabase } from "@/integrations/supabase/client";

const SENDER_DOMAIN = "it.handelsfastigheter.se";
const FROM_DOMAIN = "handelsfastigheter.se";

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
  const messageId = crypto.randomUUID();
  const { error } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      to: params.to,
      from: `SHF Intra <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: params.subject,
      html: params.html,
      purpose: "transactional",
      label: "transactional_emails",
      message_id: messageId,
      idempotency_key: `txn-${messageId}`,
      queued_at: new Date().toISOString(),
      ...(params.reply_to ? { reply_to: params.reply_to } : {}),
    },
  });
  if (error) {
    console.error("Failed to enqueue email:", error);
    throw error;
  }
}
