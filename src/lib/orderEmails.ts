import { supabase } from "@/integrations/supabase/client";
import { getAppBaseUrl } from "@/lib/utils";
import { FALLBACK_IT_EMAIL } from "@/lib/constants";

/** Fetch the IT contact email from org_chart_settings, fallback to constant default */
export async function getItContactEmail(): Promise<string> {
  const { data } = await supabase
    .from("org_chart_settings")
    .select("setting_value")
    .eq("setting_key", "it_contact_email")
    .single();
  return data?.setting_value || FALLBACK_IT_EMAIL;
}

// ─── Helper: invoke send-transactional-email Edge Function ───

async function sendTransactionalEmail(params: {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData: Record<string, any>;
}) {
  const { error } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: params.templateName,
      recipientEmail: params.recipientEmail,
      idempotencyKey: params.idempotencyKey,
      templateData: params.templateData,
    },
  });
  if (error) {
    console.error(`Failed to send ${params.templateName}:`, error);
    throw error;
  }
}

// ─── Email to approver when a new order is created ───

interface NewOrderEmailParams {
  orderId: string;
  title: string;
  description?: string | null;
  requesterName: string;
  requesterEmail: string;
  approverName: string;
  approverEmail: string;
  items: { name: string; quantity: number; description?: string | null }[];
  recipientName?: string | null;
}

export async function sendNewOrderEmailToApprover(params: NewOrderEmailParams) {
  const { orderId, title, description, requesterName, approverName, approverEmail, items, recipientName } = params;
  const orderUrl = `${getAppBaseUrl()}/orders/${orderId}`;

  try {
    await sendTransactionalEmail({
      templateName: "new-order-approval",
      recipientEmail: approverEmail,
      idempotencyKey: `new-order-approval-${orderId}`,
      templateData: {
        approverName,
        requesterName,
        title,
        description: description || undefined,
        recipientName: recipientName || undefined,
        items: items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          description: i.description || undefined,
        })),
        orderUrl,
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
  const orderUrl = `${getAppBaseUrl()}/orders/${orderId}`;

  try {
    await sendTransactionalEmail({
      templateName: "order-rejected",
      recipientEmail: requesterEmail,
      idempotencyKey: `order-rejected-${orderId}`,
      templateData: {
        requesterName,
        title,
        approverName,
        rejectionReason: rejectionReason || undefined,
        orderUrl,
      },
    });
  } catch (err) {
    console.error("Failed to send rejection email:", err);
  }
}

// ─── Approval confirmation email to requester ───

export async function sendApprovalEmail(params: {
  orderId: string;
  recipientName: string;
  recipientEmail: string;
  title: string;
  approverName?: string;
  items: { name: string; quantity?: number }[];
  isAutoApproved?: boolean;
}) {
  const orderUrl = `${getAppBaseUrl()}/orders/${params.orderId}`;

  try {
    await sendTransactionalEmail({
      templateName: "order-approved",
      recipientEmail: params.recipientEmail,
      idempotencyKey: `order-approved-${params.orderId}`,
      templateData: {
        recipientName: params.recipientName,
        title: params.title,
        approverName: params.approverName,
        isAutoApproved: params.isAutoApproved || false,
        items: params.items,
        orderUrl,
      },
    });
  } catch (err) {
    console.error("Failed to send approval email:", err);
  }
}

// ─── Delivery confirmation email to requester ───

export async function sendDeliveryEmail(params: {
  orderId: string;
  recipientName: string;
  recipientEmail: string;
  title: string;
  orderRecipientName?: string | null;
  comment?: string | null;
}) {
  const orderUrl = `${getAppBaseUrl()}/orders/${params.orderId}`;

  try {
    await sendTransactionalEmail({
      templateName: "order-delivered",
      recipientEmail: params.recipientEmail,
      idempotencyKey: `order-delivered-${params.orderId}`,
      templateData: {
        recipientName: params.recipientName,
        title: params.title,
        orderRecipientName: params.orderRecipientName || undefined,
        comment: params.comment || undefined,
        orderUrl,
      },
    });
  } catch (err) {
    console.error("Failed to send delivery email:", err);
  }
}

