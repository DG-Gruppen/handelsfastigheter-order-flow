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
  const startedAt = Date.now();
  console.log("[email] →invoke send-transactional-email", {
    template: params.templateName,
    to: params.recipientEmail,
    idempotencyKey: params.idempotencyKey,
    at: new Date().toISOString(),
  });

  const { data, error } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: params.templateName,
      recipientEmail: params.recipientEmail,
      idempotencyKey: params.idempotencyKey,
      templateData: params.templateData,
    },
  });

  const durationMs = Date.now() - startedAt;

  if (error) {
    console.error("[email] ✗ invoke failed", {
      template: params.templateName,
      to: params.recipientEmail,
      idempotencyKey: params.idempotencyKey,
      durationMs,
      error: error.message ?? String(error),
      context: (error as any).context ?? null,
    });
    // Fire-and-forget client-side log so failures show up in dashboard
    void supabase.from("email_send_log").insert({
      message_id: params.idempotencyKey,
      template_name: params.templateName,
      recipient_email: params.recipientEmail,
      status: "failed",
      error_message: `client.invoke failed: ${error.message ?? String(error)}`.slice(0, 1000),
      metadata: {
        step: "client_invoke",
        idempotency_key: params.idempotencyKey,
        duration_ms: durationMs,
        template_data_keys: Object.keys(params.templateData ?? {}),
      },
    });
    throw error;
  }

  console.log("[email] ✓ invoke ok", {
    template: params.templateName,
    to: params.recipientEmail,
    idempotencyKey: params.idempotencyKey,
    durationMs,
    response: data,
  });
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
    console.error("[email] sendNewOrderEmailToApprover failed", { orderId, err });
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
    console.error("[email] sendRejectionEmail failed", { orderId, err });
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
    console.error("[email] sendApprovalEmail failed", { orderId: params.orderId, err });
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
    console.error("[email] sendDeliveryEmail failed", { orderId: params.orderId, err });
  }
}
