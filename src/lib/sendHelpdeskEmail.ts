import { supabase } from "@/integrations/supabase/client";
import { getItContactEmail } from "@/lib/orderEmails";

interface HelpdeskEmailParams {
  orderId: string;
  title: string;
  description?: string | null;
  recipientName?: string | null;
  recipientDepartment?: string | null;
  recipientStartDate?: string | null;
  orderReason?: string | null;
  requesterName: string;
  requesterEmail: string;
  items: { name: string; description?: string | null; quantity: number }[];
  systems?: { name: string; description?: string | null }[];
}

export async function sendHelpdeskEmail(params: HelpdeskEmailParams) {
  const {
    orderId,
    title,
    description,
    recipientName,
    recipientDepartment,
    recipientStartDate,
    orderReason,
    requesterName,
    requesterEmail,
    items,
    systems = [],
  } = params;

  const itEmail = await getItContactEmail();
  const orderUrl = `${window.location.origin}/orders/${orderId}`;

  const isOnboarding = orderReason === "new_employee";
  const isOffboarding = orderReason === "end_of_employment";
  const typeLabel = isOffboarding ? "Offboarding" : isOnboarding ? "Onboarding" : "Utrustningsbeställning";

  const itemsHtml = items
    .map((i) => `<li><strong>${i.name}</strong>${i.quantity > 1 ? ` ×${i.quantity}` : ""}${i.description ? ` – ${i.description}` : ""}</li>`)
    .join("");

  const systemsHtml = systems.length > 0
    ? `<h3 style="margin:16px 0 8px;color:#1a1a2e;">System & Licenser</h3><ul>${systems.map((s) => `<li><strong>${s.name}</strong>${s.description ? ` – ${s.description}` : ""}</li>`).join("")}</ul>`
    : "";

  const recipientHtml = recipientName
    ? `<h3 style="margin:16px 0 8px;color:#1a1a2e;">Mottagare</h3>
       <table style="border-collapse:collapse;">
         <tr><td style="padding:4px 12px 4px 0;color:#666;">Namn:</td><td>${recipientName}</td></tr>
         ${recipientDepartment ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Avdelning:</td><td>${recipientDepartment}</td></tr>` : ""}
         ${recipientStartDate ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">${isOffboarding ? "Slutdatum" : "Startdatum"}:</td><td>${new Date(recipientStartDate).toLocaleDateString("sv-SE")}</td></tr>` : ""}
       </table>`
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1a1a2e;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:18px;">🎫 ${typeLabel}: ${title}</h1>
      </div>
      <div style="padding:24px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px;">
        <p style="margin:0 0 16px;color:#333;">En ny godkänd beställning har inkommit från <strong>${requesterName}</strong>.</p>
        
        ${recipientHtml}

        <h3 style="margin:16px 0 8px;color:#1a1a2e;">Utrustning</h3>
        <ul>${itemsHtml}</ul>

        ${systemsHtml}

        ${description ? `<h3 style="margin:16px 0 8px;color:#1a1a2e;">Kommentar</h3><p style="color:#333;">${description}</p>` : ""}

        <div style="margin:24px 0 0;padding:16px;background:#f0f4ff;border-radius:8px;text-align:center;">
          <a href="${orderUrl}" style="display:inline-block;padding:10px 24px;background:#1a1a2e;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Visa beställning i systemet</a>
          <p style="margin:8px 0 0;font-size:12px;color:#666;">Länken kräver inloggning</p>
        </div>
      </div>
    </div>
  `;

  const subject = `[SHF IT Beställning] ${typeLabel}: ${title}`;

  try {
    const { error } = await supabase.functions.invoke("send-email", {
      body: {
        to: "helpdesk@dggruppen.se",
        subject,
        html,
        reply_to: requesterEmail,
      },
    });
    if (error) {
      console.error("Failed to send helpdesk email:", error);
    }
  } catch (err) {
    console.error("Failed to send helpdesk email:", err);
  }
}
