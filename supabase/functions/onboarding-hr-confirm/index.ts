// Snapshots tasks from the template, resolves assignees, activates the instance
// and triggers the owner-task-batch email to each unique recipient.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type AssigneeSource = 'static_profile' | 'tool_owner' | 'area_owner' | 'role' | 'nearest_manager'

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

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  let instanceId: string
  try {
    const body = await req.json()
    instanceId = String(body.instanceId || body.instance_id || '')
    if (!instanceId) throw new Error('instanceId required')
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: corsHeaders })
  }

  // Load instance + template
  const { data: instance, error: instErr } = await admin
    .from('onboarding_instances')
    .select('*, template:onboarding_templates(*), profile:profiles!onboarding_instances_profile_id_fkey(*), manager:profiles!onboarding_instances_nearest_manager_id_fkey(*)')
    .eq('id', instanceId)
    .single()
  if (instErr || !instance) {
    return new Response(JSON.stringify({ error: 'Instance not found' }), { status: 404, headers: corsHeaders })
  }

  const kind: 'onboarding' | 'offboarding' = instance.template.kind
  const baseDate: string | null = kind === 'onboarding' ? instance.start_date : instance.last_day

  // Load template tasks
  const { data: templateTasks } = await admin
    .from('onboarding_template_tasks')
    .select('*')
    .eq('template_id', instance.template_id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // Idempotency: if tasks already exist, skip snapshot
  const { count: existingCount } = await admin
    .from('onboarding_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('instance_id', instanceId)

  const newTasks: any[] = []
  if ((existingCount ?? 0) === 0 && templateTasks) {
    for (const tt of templateTasks) {
      const assignees = await resolveAssignees(admin, tt, instance)
      const deadline = baseDate
        ? new Date(new Date(baseDate).getTime() + (tt.due_offset_days || 0) * 86400000)
            .toISOString()
            .slice(0, 10)
        : null

      if (assignees.length === 0) {
        // Fallback: unassigned, HR will need to set
        newTasks.push({
          instance_id: instanceId,
          template_task_id: tt.id,
          sort_order: tt.sort_order,
          title: tt.title,
          description: tt.description,
          category: tt.category,
          deadline_date: deadline,
          assignee_label: '(ej tilldelad)',
        })
      } else {
        for (const a of assignees) {
          newTasks.push({
            instance_id: instanceId,
            template_task_id: tt.id,
            sort_order: tt.sort_order,
            title: tt.title,
            description: tt.description,
            category: tt.category,
            deadline_date: deadline,
            assignee_profile_id: a.profile_id,
            assignee_email: a.email,
            assignee_label: a.label,
          })
        }
      }
    }
    if (newTasks.length) {
      const { error: insErr } = await admin.from('onboarding_tasks').insert(newTasks)
      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: corsHeaders })
      }
    }
  }

  // Activate instance
  await admin
    .from('onboarding_instances')
    .update({ status: 'active' })
    .eq('id', instanceId)

  // Group tasks by assignee email and send batch emails
  const { data: allTasks } = await admin
    .from('onboarding_tasks')
    .select('*, assignee:profiles!onboarding_tasks_assignee_profile_id_fkey(full_name, email)')
    .eq('instance_id', instanceId)
    .eq('status', 'pending')

  const byEmail = new Map<string, any[]>()
  for (const t of allTasks ?? []) {
    const email = t.assignee?.email || t.assignee_email
    if (!email) continue
    if (!byEmail.has(email)) byEmail.set(email, [])
    byEmail.get(email)!.push(t)
  }

  const newHireName = instance.profile?.full_name || instance.prospective_name || 'Ny medarbetare'
  const templateKey = kind === 'onboarding' ? 'onboarding-owner-task-batch' : 'offboarding-owner-task-batch'
  const sentLog: any[] = []

  for (const [email, tasks] of byEmail.entries()) {
    const firstName = tasks[0]?.assignee?.full_name?.split(' ')?.[0] || ''
    const payload = {
      instanceId,
      recipientFirstName: firstName,
      newHireName,
      startDate: instance.start_date,
      lastDay: instance.last_day,
      position: instance.prospective_title,
      managerName: instance.manager?.full_name,
      tasks: tasks.map((t) => ({
        title: t.title,
        description: t.description,
        deadline: t.deadline_date,
      })),
      deepLink: `https://intra.handelsfastigheter.se/boarding/${instanceId}`,
    }
    try {
      await admin.functions.invoke('send-transactional-email', {
        body: {
          templateName: templateKey,
          recipientEmail: email,
          idempotencyKey: `${templateKey}-${instanceId}-${email}`,
          templateData: payload,
        },
      })
      sentLog.push({
        instance_id: instanceId,
        template_key: templateKey,
        recipient_email: email,
        payload: payload as any,
      })
    } catch (e) {
      console.error('send error', email, e)
      sentLog.push({
        instance_id: instanceId,
        template_key: templateKey,
        recipient_email: email,
        payload: payload as any,
        error: String(e),
      })
    }
  }

  if (sentLog.length) {
    await admin.from('onboarding_email_log').insert(sentLog)
  }

  return new Response(
    JSON.stringify({ ok: true, tasksCreated: newTasks.length, emailsSent: sentLog.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})

async function resolveAssignees(
  admin: any,
  tt: any,
  instance: any,
): Promise<Array<{ profile_id: string | null; email: string | null; label: string }>> {
  const source: AssigneeSource = tt.assignee_source
  switch (source) {
    case 'static_profile': {
      if (!tt.assignee_profile_id) return []
      const { data } = await admin.from('profiles').select('id, full_name, email').eq('id', tt.assignee_profile_id).single()
      return data ? [{ profile_id: data.id, email: data.email, label: data.full_name }] : []
    }
    case 'tool_owner': {
      if (!tt.assignee_tool_id) return []
      const { data } = await admin
        .from('tool_owners')
        .select('profile:profiles!tool_owners_profile_id_fkey(id, full_name, email)')
        .eq('tool_id', tt.assignee_tool_id)
      return (data ?? [])
        .filter((r: any) => r.profile)
        .map((r: any) => ({ profile_id: r.profile.id, email: r.profile.email, label: r.profile.full_name }))
    }
    case 'area_owner': {
      if (!tt.assignee_area_id) return []
      const { data } = await admin
        .from('responsibility_owners')
        .select('profile:profiles!responsibility_owners_profile_id_fkey(id, full_name, email)')
        .eq('area_id', tt.assignee_area_id)
      return (data ?? [])
        .filter((r: any) => r.profile)
        .map((r: any) => ({ profile_id: r.profile.id, email: r.profile.email, label: r.profile.full_name }))
    }
    case 'nearest_manager': {
      if (!instance.manager) return []
      return [{ profile_id: instance.manager.id, email: instance.manager.email, label: instance.manager.full_name }]
    }
    case 'role': {
      if (!tt.assignee_role) return []
      // Resolve via group name matching the role (e.g. 'hr')
      const { data: groups } = await admin
        .from('groups')
        .select('id')
        .ilike('name', `%${tt.assignee_role}%`)
      const groupIds = (groups ?? []).map((g: any) => g.id)
      if (!groupIds.length) return []
      const { data: members } = await admin
        .from('group_members')
        .select('user_id')
        .in('group_id', groupIds)
      const userIds = (members ?? []).map((m: any) => m.user_id)
      if (!userIds.length) return []
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, email')
        .in('user_id', userIds)
      return (profiles ?? []).map((p: any) => ({ profile_id: p.id, email: p.email, label: p.full_name }))
    }
  }
  return []
}
