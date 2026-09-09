// Mejlutskick för on-/offboarding v2.
//
// Tunn wrapper runt sendAppEmail som (1) loggar till boarding_email_log och
// (2) kan omdirigera alla utskick till en testadress via miljövariabeln
// BOARDING_EMAIL_REDIRECT. Under bygget sätts den till en egen adress så att
// inga riktiga ansvariga får mejl. Mallarna visar en banner när
// `redirectedFrom` finns i datan.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { sendAppEmail } from './send-app-email.ts'

// Otypad klient: tabellerna i v2 finns inte i någon genererad Database-typ på serversidan.
export type BoardingDb = SupabaseClient<any>

export interface BoardingEmailArgs {
  caseId: string
  templateKey: string
  to: string
  recipientProfileId?: string | null
  templateData: Record<string, unknown>
  idempotencyKey: string
}

export function boardingEmailRedirect(): string | null {
  const v = Deno.env.get('BOARDING_EMAIL_REDIRECT')?.trim()
  return v ? v : null
}

export async function sendBoardingEmail(
  admin: BoardingDb,
  args: BoardingEmailArgs,
): Promise<{ sent: boolean; redirected: boolean }> {
  const redirect = boardingEmailRedirect()
  const actualTo = redirect ?? args.to
  const templateData = redirect
    ? { ...args.templateData, redirectedFrom: args.to }
    : args.templateData
  // Vid omdirigering går flera mottagares mejl till samma adress –
  // nyckeln måste då skilja sig per ursprunglig mottagare.
  const idempotencyKey = redirect
    ? `${args.idempotencyKey}::redirect::${args.to}`
    : args.idempotencyKey

  const result = await sendAppEmail(args.templateKey, actualTo, {
    templateData,
    idempotencyKey,
    // send-app-email är typad mot den otypade klienten – samma runtime-objekt.
    admin: admin as any,
  })

  const { error } = await admin.from('boarding_email_log').insert({
    case_id: args.caseId,
    template_key: args.templateKey,
    recipient_email: actualTo,
    recipient_profile_id: args.recipientProfileId ?? null,
    redirected_from: redirect ? args.to : null,
    payload: templateData,
    error: result.sent ? null : ('error' in result ? result.error : result.reason),
  })
  if (error) console.error('[boarding-email] log insert failed', error.message)

  return { sent: result.sent, redirected: !!redirect }
}
