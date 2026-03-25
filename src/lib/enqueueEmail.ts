import { supabase } from "@/integrations/supabase/client";

/**
 * Enqueues a transactional email via the Lovable Cloud pgmq queue.
 * The process-email-queue cron job picks up messages and sends them
 * via the Lovable Email API with automatic retries and rate-limit handling.
 */
export async function enqueueEmail(params: {
  to: string;
  subject: string;
  html: string;
  reply_to?: string;
  from_name?: string;
}) {
  const fromAddress = params.from_name
    ? `${params.from_name} via SHF Intra <noreply@handelsfastigheter.se>`
    : `SHF Intra <noreply@handelsfastigheter.se>`;

  const messageId = crypto.randomUUID();

  const payload = {
    to: params.to,
    from: fromAddress,
    sender_domain: "notify.handelsfastigheter.se",
    subject: params.subject,
    html: params.html,
    purpose: "transactional",
    label: "transactional_emails",
    message_id: messageId,
    idempotency_key: messageId,
    queued_at: new Date().toISOString(),
    ...(params.reply_to ? { reply_to: params.reply_to } : {}),
  };

  const { data, error } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: payload as any,
  });

  if (error) {
    console.error("Failed to enqueue email:", error);
    throw error;
  }

  return data;
}
