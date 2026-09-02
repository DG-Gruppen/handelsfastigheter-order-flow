// Cron-friendly: sends reminders for open tasks based on offset to start_date / last_day.
// Onboarding: T-7, T-3, T-1. Offboarding: T-3, T-0, T+1.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendAppEmail } from '../_shared/send-app-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: instances } = await admin
    .from('onboarding_instances')
    .select('id, start_date, last_day, prospective_name, template:onboarding_templates(kind), profile:profiles!onboarding_instances_profile_id_fkey(full_name, email), manager:profiles!onboarding_instances_nearest_manager_id_fkey(full_name, email)')
    .eq('status', 'active')

  let sent = 0
  for (const inst of instances ?? []) {
    const kind = (inst.template as any)?.kind
    const baseStr = kind === 'onboarding' ? inst.start_date : inst.last_day
    if (!baseStr) continue
    const base = new Date(baseStr)
    base.setHours(0, 0, 0, 0)
    const diffDays = Math.round((base.getTime() - today.getTime()) / 86400000)

    const triggers = kind === 'onboarding' ? [7, 3, 1] : [3, 0, -1]
    if (!triggers.includes(diffDays)) continue

    const { data: openTasks } = await admin
      .from('onboarding_tasks')
      .select('title, assignee_email, assignee:profiles!onboarding_tasks_assignee_profile_id_fkey(full_name, email)')
      .eq('instance_id', inst.id)
      .eq('status', 'pending')

    const byEmail = new Map<string, { firstName: string; tasks: { title: string }[] }>()
    for (const t of openTasks ?? []) {
      const email = (t.assignee as any)?.email || t.assignee_email
      if (!email) continue
      const fn = ((t.assignee as any)?.full_name || '').split(' ')[0] || ''
      if (!byEmail.has(email)) byEmail.set(email, { firstName: fn, tasks: [] })
      byEmail.get(email)!.tasks.push({ title: t.title })
    }

    const escalateToManager = kind === 'onboarding' && diffDays === 1
    if (escalateToManager && (inst.manager as any)?.email) {
      const mgrEmail = (inst.manager as any).email
      const allOpen = (openTasks ?? []).map((t) => ({ title: t.title }))
      if (allOpen.length) {
        byEmail.set(mgrEmail, {
          firstName: ((inst.manager as any).full_name || '').split(' ')[0],
          tasks: allOpen,
        })
      }
    }

    const newHireName =
      (inst.profile as any)?.full_name || inst.prospective_name || 'medarbetare'
    const templateKey = kind === 'onboarding' ? 'onboarding-reminder' : 'offboarding-reminder'

    for (const [email, info] of byEmail.entries()) {
      try {
        await sendAppEmail(templateKey, email, {
        idempotencyKey: `${templateKey}-${inst.id}-${email}-${baseStr}-${diffDays}`,
        templateData: {
              instanceId: inst.id,
              recipientFirstName: info.firstName,
              newHireName,
              startDate: inst.start_date,
              lastDay: inst.last_day,
              daysUntilStart: diffDays,
              daysUntilExit: diffDays,
              openTasks: info.tasks,
              deepLink: `https://intra.handelsfastigheter.se/boarding/${inst.id}`,
              escalatedToManager: escalateToManager && email === (inst.manager as any)?.email,
            },
        admin,
      })
        sent++
      } catch (e) {
        console.error('reminder error', email, e)
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
