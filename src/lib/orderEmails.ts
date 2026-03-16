import { supabase } from "@/integrations/supabase/client";

/** Fetch the IT contact email from org_chart_settings, fallback to hardcoded default */
export async function getItContactEmail(): Promise<string> {
  const { data } = await supabase
    .from("org_chart_settings")
    .select("setting_value")
    .eq("setting_key", "it_contact_email")
    .single();
  return data?.setting_value || "helpdesk@dggruppen.se";
}

function emailShell(title: string, body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#1a1a2e;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:18px;">${title}</h1>
    </div>
    <div style="padding:24px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px;">
      ${body}
    </div>
  </div>`;
}

function orderButton(orderUrl: string, label = "Visa beställning"): string {
  return `<div style="margin:24px 0 0;padding:16px;background:#f0f4ff;border-radius:8px;text-align:center;">
    <a href="${orderUrl}" style="display:inline-block;padding:10px 24px;background:#1a1a2e;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">${label}</a>
    <p style="margin:8px 0 0;font-size:12px;color:#666;">Länken kräver inloggning</p>
  </div>`;
}

function itemsListHtml(items: { name: string; quantity: number; description?: string | null }[]): string {
  return items
    .map((i) => `<li><strong>${i.name}</strong>${i.quantity > 1 ? ` ×${i.quantity}` : ""}${i.description ? ` – ${i.description}` : ""}</li>`)
    .join("");
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
  const orderUrl = `${window.location.origin}/orders/${orderId}`;
  const recipientLine = recipientName ? `<p style="margin:0 0 8px;color:#333;">Mottagare: <strong>${recipientName}</strong></p>` : "";

  const html = emailShell("📋 Ny beställning att attestera", `
    <p style="margin:0 0 16px;color:#333;">Hej <strong>${approverName}</strong>,</p>
    <p style="margin:0 0 16px;color:#333;"><strong>${requesterName}</strong> har skickat en beställning som behöver din attestering:</p>
    <p style="margin:0 0 8px;color:#333;"><strong>"${title}"</strong></p>
    ${recipientLine}
    ${description ? `<p style="margin:0 0 16px;color:#666;font-style:italic;">${description}</p>` : ""}
    <h3 style="margin:16px 0 8px;color:#1a1a2e;">Utrustning</h3>
    <ul>${itemsListHtml(items)}</ul>
    ${orderButton(orderUrl, "Granska och attestera")}
  `);

  try {
    await supabase.functions.invoke("send-email", {
      body: {
        to: approverEmail,
        subject: `[SHF IT] Ny beställning att attestera: ${title}`,
        html,
        reply_to: params.approverEmail, // not needed but harmless
      },
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
  const orderUrl = `${window.location.origin}/orders/${orderId}`;

  const reasonHtml = rejectionReason
    ? `<div style="margin:16px 0;padding:12px 16px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;">
         <p style="margin:0 0 4px;font-size:12px;color:#666;font-weight:bold;">Motivering:</p>
         <p style="margin:0;color:#333;">${rejectionReason}</p>
       </div>`
    : "";

  const html = emailShell("❌ Beställning avslagen", `
    <p style="margin:0 0 16px;color:#333;">Hej <strong>${requesterName}</strong>,</p>
    <p style="margin:0 0 16px;color:#333;">Din beställning <strong>"${title}"</strong> har avslagits av <strong>${approverName}</strong>.</p>
    ${reasonHtml}
    ${orderButton(orderUrl)}
  `);

  try {
    await supabase.functions.invoke("send-email", {
      body: {
        to: requesterEmail,
        subject: `[SHF IT] Din beställning har avslagits: ${title}`,
        html,
      },
    });
  } catch (err) {
    console.error("Failed to send rejection email:", err);
  }
}
