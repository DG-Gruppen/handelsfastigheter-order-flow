// On-/offboarding v2: bocka av en uppgift (done / not_applicable / pending).
// Uppdateringen går via användarens klient så att RLS avgör vem som får
// (ansvarig, närmaste chef, HR/admin/IT). När sista uppgiften är klar sätts
// ärendet till completed och chef + HR får besked.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendBoardingEmail, type BoardingDb } from '../_shared/boarding-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const SITE_URL = 'https://intra.handelsfastigheter.se'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient: BoardingDb = createClient<any>(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''))
  const userId = claims?.claims?.sub as string | undefined
  if (!userId) return json({ error: 'Unauthorized' }, 401)
  const admin: BoardingDb = createClient<any>(SUPABASE_URL, SERVICE_KEY)

  let taskId: string
  let status: 'done' | 'not_applicable' | 'pending'
  let note: string | undefined
  try {
    const body = await req.json()
    taskId = String(body.taskId ?? '')
    status = body.status ?? 'done'
    note = body.note
    if (!taskId) throw new Error('taskId krävs')
    if (!['done', 'not_applicable', 'pending'].includes(status)) throw new Error('Ogiltig status')
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 400)
  }

  const update: Record<string, unknown> = { status, note: note ?? null }
  if (status === 'pending') {
    update.done_at = null
    update.done_by = null
  } else {
    update.done_at = new Date().toISOString()
    update.done_by = userId
  }

  const { data: updated, error: updErr } = await userClient
    .from('boarding_case_tasks')
    .update(update)
    .eq('id', taskId)
    .select('case_id')
    .single()
  if (updErr) return json({ error: updErr.message }, 403)

  const { count: openCount } = await admin
    .from('boarding_case_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('case_id', updated.case_id)
    .eq('status', 'pending')

  let completed = false
  if ((openCount ?? 0) === 0) {
    const { data: c } = await admin
      .from('boarding_cases')
      .select('*, manager:profiles!boarding_cases_nearest_manager_id_fkey(id, full_name, email)')
      .eq('id', updated.case_id)
      .single()

    if (c && c.status === 'active') {
      await admin
        .from('boarding_cases')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', c.id)
      completed = true

      const personName = `${c.first_name} ${c.last_name}`.trim()
      const recipients = new Map<string, { profileId: string | null; firstName: string }>()
      if (c.manager?.email) {
        recipients.set(c.manager.email, {
          profileId: c.manager.id,
          firstName: (c.manager.full_name ?? '').split(' ')[0],
        })
      }
      const { data: hrGroup } = await admin.from('groups').select('id').ilike('name', 'HR').maybeSingle()
      if (hrGroup) {
        const { data: members } = await admin.from('group_members').select('user_id').eq('group_id', hrGroup.id)
        const ids = (members ?? []).map((m: any) => m.user_id)
        if (ids.length) {
          const { data: profiles } = await admin.from('profiles').select('id, full_name, email').in('user_id', ids)
          for (const p of profiles ?? []) {
            if (p.email && !recipients.has(p.email)) {
              recipients.set(p.email, { profileId: p.id, firstName: (p.full_name ?? '').split(' ')[0] })
            }
          }
        }
      }

      for (const [email, r] of recipients) {
        await sendBoardingEmail(admin, {
          caseId: c.id,
          templateKey: 'boarding-completed',
          to: email,
          recipientProfileId: r.profileId,
          idempotencyKey: `boarding-completed-${c.id}-${email}`,
          templateData: {
            kind: c.kind,
            caseId: c.id,
            recipientFirstName: r.firstName,
            personName,
            startDate: c.start_date,
            lastDay: c.last_day,
            deepLink: `${SITE_URL}/boardingv2/${c.id}`,
          },
        })
      }
    }
  }

  return json({ ok: true, completed })
})
