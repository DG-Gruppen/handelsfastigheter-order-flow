// Shared wrapper around the managed send helper that keeps the project's
// email_send_log history intact (sent / suppressed / failed rows).
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  sendTemplateEmail,
  type SendTemplateEmailResult,
} from './transactional-email-templates/send-email.ts'

type AdminClient = ReturnType<typeof createClient>

function logClient(): AdminClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

async function writeLog(
  admin: AdminClient,
  row: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from('email_send_log').insert(row)
  if (error) {
    console.error('[email] failed to write email_send_log', {
      code: error.code,
      message: error.message,
    })
  }
}

/**
 * Sends a registered template through Lovable's managed email API and records
 * the outcome in email_send_log. Never throws — callers get the result and
 * decide what to do next.
 */
export async function sendAppEmail(
  templateName: string,
  recipientEmail: string,
  options: {
    templateData?: Record<string, unknown>
    idempotencyKey?: string
    replyTo?: string
    admin?: AdminClient
  } = {},
): Promise<SendTemplateEmailResult | { sent: false; reason: 'failed'; error: string }> {
  const admin = options.admin ?? logClient()
  const baseRow = {
    message_id: options.idempotencyKey ?? null,
    template_name: templateName,
    recipient_email: recipientEmail,
  }

  try {
    const result = await sendTemplateEmail(templateName, recipientEmail, {
      templateData: options.templateData as Record<string, any> | undefined,
      idempotencyKey: options.idempotencyKey,
      replyTo: options.replyTo,
    })

    if (result.sent) {
      await writeLog(admin, { ...baseRow, status: 'sent' })
    } else {
      await writeLog(admin, { ...baseRow, status: 'suppressed' })
    }
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[email] send failed', { template: templateName, message })
    await writeLog(admin, {
      ...baseRow,
      status: 'failed',
      error_message: message.slice(0, 1000),
    })
    return { sent: false, reason: 'failed', error: message }
  }
}
