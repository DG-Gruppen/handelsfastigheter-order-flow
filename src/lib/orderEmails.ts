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

  const { data, error } = await supabase.functions.invoke("send-order-email", {
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

/**
 * Resolve approver email and send the new-order-approval mail.
 * Logs every skip-reason (missing profile / missing email / unexpected error)
 * to email_send_log so silent failures become visible in the admin dashboard.
 */
// Retry configuration: 3 attempts with exponential backoff (1s, 2s, 4s)
const RETRY_DELAYS_MS = [1000, 2000, 4000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function notifyApproverOfNewOrder(args: {
  orderId: string;
  approverUserId: string;
  approverProfile: { full_name: string } | undefined;
  title: string;
  description?: string | null;
  requesterName: string;
  requesterEmail: string;
  items: { name: string; quantity: number; description?: string | null }[];
  recipientName?: string | null;
}) {
  const idempotencyKey = `new-order-approval-${args.orderId}`;

  const logSkip = async (reason: string, recipient = "unknown@unknown") => {
    console.warn("[email] notifyApproverOfNewOrder skipped", { orderId: args.orderId, reason });
    await supabase.from("email_send_log").insert({
      message_id: idempotencyKey,
      template_name: "new-order-approval",
      recipient_email: recipient,
      status: "failed",
      error_message: reason.slice(0, 1000),
      metadata: {
        step: "pre_send_skip",
        order_id: args.orderId,
        approver_user_id: args.approverUserId,
      },
    });
  };

  const logAttempt = async (
    recipient: string,
    attempt: number,
    status: "attempting" | "succeeded" | "failed",
    errorMessage?: string,
  ) => {
    await supabase.from("email_send_log").insert({
      message_id: idempotencyKey,
      template_name: "new-order-approval",
      recipient_email: recipient,
      status: status === "succeeded" ? "sent" : status === "failed" ? "failed" : "pending",
      error_message: errorMessage ? errorMessage.slice(0, 1000) : null,
      metadata: {
        step: `retry_attempt_${attempt}`,
        attempt,
        max_attempts: RETRY_DELAYS_MS.length,
        order_id: args.orderId,
        approver_user_id: args.approverUserId,
      },
    });
  };

  try {
    if (!args.approverProfile) {
      await logSkip("Approver profile not found in cache");
      return;
    }

    const { data: approverEmailData, error: emailErr } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", args.approverUserId)
      .single();

    if (emailErr) {
      await logSkip(`Failed to fetch approver email: ${emailErr.message}`);
      return;
    }
    if (!approverEmailData?.email) {
      await logSkip("Approver profile has no email address");
      return;
    }

    const approverEmail = approverEmailData.email;
    let lastError: any = null;

    // Attempt with exponential backoff
    for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        await logAttempt(approverEmail, attempt, "attempting");

        await sendNewOrderEmailToApprover({
          orderId: args.orderId,
          title: args.title,
          description: args.description ?? undefined,
          requesterName: args.requesterName,
          requesterEmail: args.requesterEmail,
          approverName: args.approverProfile.full_name,
          approverEmail,
          items: args.items,
          recipientName: args.recipientName ?? undefined,
        });

        await logAttempt(approverEmail, attempt, "succeeded");
        console.log("[email] notifyApproverOfNewOrder succeeded", {
          orderId: args.orderId,
          attempt,
        });
        return;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message ?? String(err);
        console.warn("[email] notifyApproverOfNewOrder attempt failed", {
          orderId: args.orderId,
          attempt,
          error: errMsg,
        });
        await logAttempt(approverEmail, attempt, "failed", `Attempt ${attempt} failed: ${errMsg}`);

        // Wait before next attempt (unless this was the last)
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt - 1]);
        }
      }
    }

    // All attempts exhausted
    console.error("[email] notifyApproverOfNewOrder all retries exhausted", {
      orderId: args.orderId,
      attempts: RETRY_DELAYS_MS.length,
      lastError: lastError?.message ?? String(lastError),
    });
    await supabase.from("email_send_log").insert({
      message_id: idempotencyKey,
      template_name: "new-order-approval",
      recipient_email: approverEmail,
      status: "dlq",
      error_message: `All ${RETRY_DELAYS_MS.length} attempts failed. Last error: ${lastError?.message ?? String(lastError)}`.slice(0, 1000),
      metadata: {
        step: "retries_exhausted",
        total_attempts: RETRY_DELAYS_MS.length,
        order_id: args.orderId,
        approver_user_id: args.approverUserId,
      },
    });
  } catch (err: any) {
    console.error("[email] notifyApproverOfNewOrder unexpected error", { orderId: args.orderId, err });
    await supabase.from("email_send_log").insert({
      message_id: idempotencyKey,
      template_name: "new-order-approval",
      recipient_email: "unknown@unknown",
      status: "failed",
      error_message: `Unexpected error: ${err?.message ?? String(err)}`.slice(0, 1000),
      metadata: { step: "pre_send_exception", order_id: args.orderId },
    });
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
