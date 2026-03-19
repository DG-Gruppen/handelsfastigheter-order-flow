import { supabase } from "@/integrations/supabase/client";
import { getAppBaseUrl } from "@/lib/utils";
import { FALLBACK_IT_EMAIL } from "@/lib/constants";
import {
  emailLayout, emailGreeting, emailText, emailHeading,
  emailItemsList, emailButton, emailWarningCallout, escapeHtml,
} from "@/lib/emailTemplates";

/** Fetch the IT contact email from org_chart_settings, fallback to constant default */
export async function getItContactEmail(): Promise<string> {
  const { data } = await supabase
    .from("org_chart_settings")
    .select("setting_value")
    .eq("setting_key", "it_contact_email")
    .single();
  return data?.setting_value || FALLBACK_IT_EMAIL;
}

// ─── Email to approver when a new order is created ───

interface NewOrderEmailParams {
  orderId: string;
  title: string;
  description?: string | null;
  requesterName: string;
  approverName: string;
  approverEmail: string;
  items: { name: string; quantity: number; description?: string | null }[];
  recipientName?: string | null;
}

export async function sendNewOrderEmailToApprover(params: NewOrderEmailParams) {
  const { orderId, title, description, requesterName, approverName, approverEmail, items, recipientName } = params;
  const orderUrl = `${getAppBaseUrl()}/orders/${orderId}`;

  const recipientLine = recipientName
    ? emailText(`Mottagare: <strong>${escapeHtml(recipientName)}</strong>`)
    : "";

  const html = emailLayout("Ny beställning att attestera", "📋", `
    ${emailGreeting(approverName)}
    ${emailText(`<strong>${escapeHtml(requesterName)}</strong> har skickat en beställning som behöver din attestering:`)}
    ${emailText(`<strong>&ldquo;${escapeHtml(title)}&rdquo;</strong>`)}
    ${recipientLine}
    ${description ? emailText(`<em style="color:#6b7685;">${escapeHtml(description)}</em>`) : ""}
    ${emailHeading("Utrustning")}
    ${emailItemsList(items)}
    ${emailButton(orderUrl, "Granska och attestera")}
  `);

  try {
    await supabase.functions.invoke("send-email", {
      body: { to: approverEmail, subject: `[SHF IT] Ny beställning att attestera: ${title}`, html },
    });
  } catch (err) {
    console.error("Failed to send new order email to approver:", err);
  }
}

// ─── Email to requester when order is rejected ───

interface RejectionEmailParams {
  orderId: string;
  title: string;
  requesterName: string;
  requesterEmail: string;
  approverName: string;
  rejectionReason?: string | null;
}

export async function sendRejectionEmail(params: RejectionEmailParams) {
  const { orderId, title, requesterName, requesterEmail, approverName, rejectionReason } = params;
  const orderUrl = `${getAppBaseUrl()}/orders/${orderId}`;

  const reasonHtml = rejectionReason
    ? emailWarningCallout("Motivering", rejectionReason)
    : "";

  const html = emailLayout("Beställning avslagen", "❌", `
    ${emailGreeting(requesterName)}
    ${emailText(`Din beställning <strong>&ldquo;${escapeHtml(title)}&rdquo;</strong> har avslagits av <strong>${escapeHtml(approverName)}</strong>.`)}
    ${reasonHtml}
    ${emailButton(orderUrl, "Visa beställning")}
  `);

  try {
    await supabase.functions.invoke("send-email", {
      body: { to: requesterEmail, subject: `[SHF IT] Din beställning har avslagits: ${title}`, html },
    });
  } catch (err) {
    console.error("Failed to send rejection email:", err);
  }
}

// ─── Approval confirmation email to requester ───

export function buildApprovalEmailHtml(params: {
  recipientName: string;
  title: string;
  approverName?: string;
  items: { name: string; quantity?: number }[];
  orderUrl: string;
  isAutoApproved?: boolean;
}): string {
  const { recipientName, title, approverName, items, orderUrl, isAutoApproved } = params;
  const approvalText = isAutoApproved
    ? `Din beställning <strong>&ldquo;${escapeHtml(title)}&rdquo;</strong> har godkänts automatiskt och skickats vidare till IT för hantering.`
    : `Din beställning <strong>&ldquo;${escapeHtml(title)}&rdquo;</strong> har godkänts av <strong>${escapeHtml(approverName ?? "")}</strong> och skickats vidare till IT för hantering.`;

  return emailLayout("Beställning godkänd", "✅", `
    ${emailGreeting(recipientName)}
    ${emailText(approvalText)}
    ${emailHeading("Beställd utrustning")}
    ${emailItemsList(items)}
    ${emailButton(orderUrl, "Visa din beställning")}
  `);
}

// ─── Delivery confirmation email to requester ───

export function buildDeliveryEmailHtml(params: {
  recipientName: string;
  title: string;
  orderRecipientName?: string | null;
  comment?: string | null;
  orderUrl: string;
}): string {
  const { recipientName, title, orderRecipientName, comment, orderUrl } = params;
  const recipientLine = orderRecipientName
    ? emailText(`Mottagare: <strong>${escapeHtml(orderRecipientName)}</strong>`)
    : "";
  const commentHtml = comment
    ? `<div style="margin:16px 0;padding:14px 18px;background:#f4f5f7;border-left:4px solid #2e4a62;border-radius:0 8px 8px 0;">
         <p style="margin:0 0 4px;font-size:11px;color:#6b7685;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Kommentar från IT</p>
         <p style="margin:0;font-size:14px;color:#1a2332;line-height:1.5;">${escapeHtml(comment)}</p>
       </div>`
    : "";

  return emailLayout("Beställning levererad", "📦", `
    ${emailGreeting(recipientName)}
    ${emailText(`Din beställning <strong>&ldquo;${escapeHtml(title)}&rdquo;</strong> har nu markerats som levererad.`)}
    ${recipientLine}
    ${commentHtml}
    ${emailButton(orderUrl, "Visa beställning")}
  `);
}
