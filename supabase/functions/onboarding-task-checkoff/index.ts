// Marks a task as done (or not_applicable). On all-done, completes the instance
// and sends the completed email to HR + manager.
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

  let taskId: string
  let status: 'done' | 'not_applicable' | 'pending'
  let note: string | undefined
  try {
    const body = await req.json()
    taskId = String(body.taskId || body.task_id)
    status = body.status || 'done'
    note = body.note
    if (!taskId) throw new Error('taskId required')
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: corsHeaders })
  }

  // Update via user client to honour RLS (assignee or HR can update)
  const update: any = { status, note: note ?? undefined }
  if (status === 'done' || status === 'not_applicable') {
    update.done_at = new Date().toISOString()
    update.done_by = userId
  } else {
    update.done_at = null
    update.done_by = null
  }

  const { data: updated, error: updErr } = await userClient
    .from('onboarding_tasks')
    .update(update)
    .eq('id', taskId)
    .select('instance_id')
    .single()
  if (updErr) {
    return new Response(JSON.stringify({ error: updErr.message }), { status: 403, headers: corsHeaders })
  }

  // Check completion (with service role so we see all tasks)
  const { count: openCount } = await admin
    .from('onboarding_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('instance_id', updated.instance_id)
    .eq('status', 'pending')

  let completed = false
  if ((openCount ?? 0) === 0) {
    const { data: inst } = await admin
      .from('onboarding_instances')
      .select('*, template:onboarding_templates(kind), profile:profiles!onboarding_instances_profile_id_fkey(full_name, email), manager:profiles!onboarding_instances_nearest_manager_id_fkey(full_name, email)')
      .eq('id', updated.instance_id)
      .single()
    if (inst && inst.status !== 'completed') {
      await admin
        .from('onboarding_instances')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', updated.instance_id)
      completed = true

      const kind = inst.template.kind
      const templateKey = kind === 'onboarding' ? 'onboarding-completed' : 'offboarding-completed'
      const newHireName = inst.profile?.full_name || inst.prospective_name || 'medarbetare'
      const recipients = [inst.manager?.email].filter(Boolean) as string[]

      for (const email of recipients) {
        try {
          await sendAppEmail(templateKey, email, {
        idempotencyKey: `${templateKey}-${inst.id}-${email}`,
        templateData: {
                instanceId: inst.id,
                newHireName,
                startDate: inst.start_date,
                lastDay: inst.last_day,
                deepLink: `https://intra.handelsfastigheter.se/boarding/${inst.id}`,
              },
        admin,
      })
        } catch (e) {
          console.error('completed-email error', email, e)
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, completed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
