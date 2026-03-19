import { supabase } from "@/integrations/supabase/client";
import { getItContactEmail } from "@/lib/orderEmails";
import { getAppBaseUrl } from "@/lib/utils";
import {
  emailLayout, emailText, emailHeading,
  emailItemsList, emailSystemsList, emailRecipientInfo, emailButton, escapeHtml,
} from "@/lib/emailTemplates";

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
    orderId, title, description, recipientName, recipientDepartment,
    recipientStartDate, orderReason, requesterName, requesterEmail,
    items, systems = [],
  } = params;

  const itEmail = await getItContactEmail();
  const orderUrl = `${getAppBaseUrl()}/orders/${orderId}`;

  const isOnboarding = orderReason === "new_employee";
  const isOffboarding = orderReason === "end_of_employment";
  const typeLabel = isOffboarding ? "Offboarding" : isOnboarding ? "Onboarding" : "Utrustningsbeställning";

  const recipientHtml = recipientName
    ? emailRecipientInfo({
        name: recipientName,
        department: recipientDepartment,
        date: recipientStartDate,
        dateLabel: isOffboarding ? "Slutdatum" : "Startdatum",
      })
    : "";

  const html = emailLayout(`${escapeHtml(typeLabel)}: ${escapeHtml(title)}`, "🎫", `
    ${emailText(`En ny godkänd beställning har inkommit från <strong>${escapeHtml(requesterName)}</strong>.`)}
    ${recipientHtml}
    ${emailHeading("Utrustning")}
    ${emailItemsList(items)}
    ${emailSystemsList(systems)}
    ${description ? `${emailHeading("Kommentar")}${emailText(escapeHtml(description))}` : ""}
    ${emailButton(orderUrl, "Visa beställning i systemet")}
  `);

  const subject = `[SHF IT Beställning] ${typeLabel}: ${title}`;

  try {
    const { error } = await supabase.functions.invoke("send-email", {
      body: { to: itEmail, subject, html, reply_to: requesterEmail },
    });
    if (error) console.error("Failed to send helpdesk email:", error);
  } catch (err) {
    console.error("Failed to send helpdesk email:", err);
  }
}
