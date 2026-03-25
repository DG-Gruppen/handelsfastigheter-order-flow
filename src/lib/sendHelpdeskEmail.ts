import { supabase } from "@/integrations/supabase/client";
import { getItContactEmail } from "@/lib/orderEmails";
import { getAppBaseUrl } from "@/lib/utils";

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
    recipientStartDate, orderReason, requesterName,
    items, systems = [],
  } = params;

  const itEmail = await getItContactEmail();
  const orderUrl = `${getAppBaseUrl()}/orders/${orderId}`;

  const isOnboarding = orderReason === "new_employee";
  const isOffboarding = orderReason === "end_of_employment";
  const typeLabel = isOffboarding ? "Offboarding" : isOnboarding ? "Onboarding" : "Utrustningsbeställning";
  const dateLabel = isOffboarding ? "Slutdatum" : "Startdatum";

  const recipientDate = recipientStartDate
    ? new Date(recipientStartDate).toLocaleDateString("sv-SE")
    : undefined;

  try {
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "helpdesk-order",
        recipientEmail: itEmail,
        idempotencyKey: `helpdesk-order-${orderId}`,
        templateData: {
          typeLabel,
          title,
          requesterName,
          recipientName: recipientName || undefined,
          recipientDepartment: recipientDepartment || undefined,
          recipientDate,
          dateLabel,
          description: description || undefined,
          items: items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            description: i.description || undefined,
          })),
          systems: systems
            .filter((s) => s.name)
            .map((s) => ({
              name: s.name,
              description: s.description || undefined,
            })),
          orderUrl,
        },
      },
    });

    if (error) {
      console.error("Failed to send helpdesk email:", error);
    }
  } catch (err) {
    console.error("Failed to send helpdesk email:", err);
  }
}
