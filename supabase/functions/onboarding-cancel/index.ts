// Cancels an instance and notifies all assignees with still-open tasks.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendAppEmail } from '../_shared/send-app-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''))
  if (!claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
  }
  const userId = claims.claims.sub
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  let instanceId: string
  let reason: string
  try {
    const body = await req.json()
    instanceId = String(body.instanceId || body.instance_id)
    reason = String(body.reason || '')
    if (!instanceId) throw new Error('instanceId required')
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: corsHeaders })
  }

  // Update via user client (RLS: HR/admin only)
  const { error: updErr } = await userClient
    .from('onboarding_instances')
    .update({
      status: 'cancelled',
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', instanceId)
  if (updErr) {
    return new Response(JSON.stringify({ error: updErr.message }), { status: 403, headers: corsHeaders })
  }

  const { data: inst } = await admin
    .from('onboarding_instances')
    .select('*, template:onboarding_templates(kind), profile:profiles!onboarding_instances_profile_id_fkey(full_name)')
    .eq('id', instanceId)
    .single()
  const kind = inst?.template?.kind
  const templateKey = kind === 'onboarding' ? 'onboarding-cancelled' : 'offboarding-cancelled'
  const newHireName = inst?.profile?.full_name || inst?.prospective_name || 'medarbetare'

  // Notify recipients with open tasks
  const { data: openTasks } = await admin
    .from('onboarding_tasks')
    .select('assignee_email, assignee:profiles!onboarding_tasks_assignee_profile_id_fkey(email)')
    .eq('instance_id', instanceId)
    .eq('status', 'pending')

  const emails = new Set<string>()
  for (const t of openTasks ?? []) {
    const e = t.assignee?.email || t.assignee_email
    if (e) emails.add(e)
  }

  // Resolve canceller name
  const { data: cancellerProfile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('user_id', userId)
    .single()

  for (const email of emails) {
    try {
      await sendAppEmail(templateKey, email, {
        idempotencyKey: `${templateKey}-${instanceId}-${email}`,
        templateData: {
            instanceId,
            newHireName,
            cancelReason: reason,
            cancelledByName: cancellerProfile?.full_name || 'HR',
          },
        admin,
      })
    } catch (e) {
      console.error('cancel-email error', email, e)
    }
  }

  return new Response(JSON.stringify({ ok: true, notified: emails.size }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
