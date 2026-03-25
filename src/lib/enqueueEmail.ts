import { supabase } from "@/integrations/supabase/client";

/**
 * Sends an email via the send-email Edge Function (Resend).
 * Temporary solution until Lovable Cloud email infrastructure is verified.
 */
export async function enqueueEmail(params: {
  to: string;
  subject: string;
  html: string;
  reply_to?: string;
  from_name?: string;
}) {
  const fromAddress = params.from_name
    ? `${params.from_name} via SHF Intra <noreply@it.handelsfastigheter.se>`
    : `SHF Intra <noreply@it.handelsfastigheter.se>`;

  const { data, error } = await supabase.functions.invoke("send-email", {
    body: {
      to: params.to,
      subject: params.subject,
      html: params.html,
      from: fromAddress,
      ...(params.reply_to ? { reply_to: params.reply_to } : {}),
    },
  });

  if (error) {
    console.error("Failed to send email via Resend:", error);
    throw error;
  }

  return data;
}
