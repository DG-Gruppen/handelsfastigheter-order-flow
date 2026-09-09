// On-/offboarding v2: alla statusövergångar för ett ärende.
//
//   create          staff/chef skapar ärende (manuellt eller simulerad Heartpace-post)
//                   → status awaiting_manager, mejl till närmaste chef
//   manager_submit  chefen väljer system + "om aktuellt" och skickar in
//                   → awaiting_hr om mallen kräver HR-bekräftelse, annars aktivering
//   hr_confirm      HR/admin/IT bekräftar → aktivering
//   cancel          staff eller chef avbryter → mejl till alla med öppna uppgifter
//
// Aktivering = mallen snapshottas till boarding_case_tasks (bara uppgifter
// vars villkor är uppfyllda), ansvariga resolvas, ett samlat mejl per mottagare.
// Heartpace-intaget (senare etapp) anropar samma create-väg.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendBoardingEmail, type BoardingDb } from '../_shared/boarding-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const SITE_URL = 'https://intra.handelsfastigheter.se'
const caseLink = (id: string) => `${SITE_URL}/boardingv2/${id}`

// Villkorsnycklar som utvärderas från ärendet (chefen kryssar inte i dem)
const AUTO_KEYS = new Set(['location_stockholm', 'trigger_manual'])

type Kind = 'onboarding' | 'offboarding'
type AdminClient = BoardingDb

interface Caller {
  userId: string
  profileId: string | null
  fullName: string | null
  isStaff: boolean
  isManagerGroup: boolean
}

interface Assignee {
  profile_id: string | null
  external_contact_id: string | null
  email: string | null
  label: string
}

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

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''))
  const userId = claims?.claims?.sub as string | undefined
  if (!userId) return json({ error: 'Unauthorized' }, 401)

  const admin: AdminClient = createClient<any>(SUPABASE_URL, SERVICE_KEY)
  const caller = await loadCaller(admin, userId)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Ogiltig JSON' }, 400)
  }

  try {
    switch (body.action) {
      case 'create':
        return json(await createCase(admin, caller, body))
      case 'manager_submit':
        return json(await managerSubmit(admin, caller, body))
      case 'hr_confirm':
        return json(await hrConfirm(admin, caller, body))
      case 'cancel':
        return json(await cancelCase(admin, caller, body))
      default:
        return json({ error: `Okänd action: ${body.action}` }, 400)
    }
  } catch (e) {
    const err = e as Error & { status?: number }
    console.error('[boarding-case-advance]', body?.action, err.message)
    return json({ error: err.message }, err.status ?? 500)
  }
})

function fail(message: string, status: number): never {
  const err = new Error(message) as Error & { status?: number }
  err.status = status
  throw err
}

async function loadCaller(admin: AdminClient, userId: string): Promise<Caller> {
  const [{ data: profile }, { data: isStaff }, { data: isManagerGroup }] = await Promise.all([
    admin.from('profiles').select('id, full_name').eq('user_id', userId).maybeSingle(),
    admin.rpc('boarding_is_staff', { _user_id: userId }),
    admin.rpc('is_in_manager_group', { _user_id: userId }),
  ])
  return {
    userId,
    profileId: profile?.id ?? null,
    fullName: profile?.full_name ?? null,
    isStaff: isStaff === true,
    isManagerGroup: isManagerGroup === true,
  }
}

async function loadCase(admin: AdminClient, caseId: string) {
  const { data, error } = await admin
    .from('boarding_cases')
    .select('*, template:boarding_templates(*), manager:profiles!boarding_cases_nearest_manager_id_fkey(id, full_name, email)')
    .eq('id', caseId)
    .single()
  if (error || !data) fail('Ärendet hittades inte', 404)
  return data
}

const personName = (c: any) => `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Ny medarbetare'

function assertCanActAsManager(caller: Caller, c: any) {
  const isManager = !!caller.profileId && caller.profileId === c.nearest_manager_id
  if (!caller.isStaff && !isManager) fail('Bara närmaste chef eller HR/admin/IT kan göra detta', 403)
}

// ---------------------------------------------------------------- create
async function createCase(admin: AdminClient, caller: Caller, body: any) {
  if (!caller.isStaff && !caller.isManagerGroup) fail('Bara HR/admin/IT eller chefer kan skapa ärenden', 403)

  const kind: Kind = body.kind === 'offboarding' ? 'offboarding' : 'onboarding'
  const triggerSource = body.triggerSource === 'simulated' ? 'simulated' : 'manual'

  // Mall: angiven eller standard för typen
  let templateId: string | undefined = body.templateId
  if (!templateId) {
    const { data: tpl } = await admin
      .from('boarding_templates')
      .select('id')
      .eq('kind', kind)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle()
    templateId = tpl?.id
  }
  if (!templateId) fail(`Ingen aktiv mall för ${kind}`, 400)

  // Offboarding utgår från en befintlig profil
  let firstName = String(body.firstName ?? '').trim()
  let lastName = String(body.lastName ?? '').trim()
  let workEmail = body.workEmail ? String(body.workEmail).trim().toLowerCase() : null
  let title = body.title ?? null
  let department = body.department ?? null
  let nearestManagerId = body.nearestManagerId ?? null

  if (body.profileId) {
    const { data: p } = await admin
      .from('profiles')
      .select('id, full_name, email, title_override, department, manager_id')
      .eq('id', body.profileId)
      .maybeSingle()
    if (!p) fail('Profilen hittades inte', 404)
    const parts = (p.full_name ?? '').trim().split(/\s+/)
    if (!firstName) firstName = parts[0] ?? ''
    if (!lastName) lastName = parts.slice(1).join(' ')
    workEmail = workEmail ?? p.email ?? null
    title = title ?? p.title_override ?? null
    department = department ?? p.department ?? null
    nearestManagerId = nearestManagerId ?? p.manager_id ?? null
  }
  if (!firstName || !lastName) fail('För- och efternamn krävs', 400)
  if (kind === 'onboarding' && !body.startDate) fail('Startdatum krävs', 400)
  if (kind === 'offboarding' && !body.lastDay) fail('Sista dag krävs', 400)

  const { data: created, error } = await admin
    .from('boarding_cases')
    .insert({
      kind,
      template_id: templateId,
      status: 'awaiting_manager',
      trigger_source: triggerSource,
      profile_id: body.profileId ?? null,
      heartpace_employee_id: body.heartpaceEmployeeId ?? null,
      first_name: firstName,
      last_name: lastName,
      work_email: workEmail,
      personal_email: body.personalEmail ? String(body.personalEmail).trim().toLowerCase() : null,
      title,
      department,
      location: body.location ?? null,
      cost_centre: body.costCentre ?? null,
      employment_form: body.employmentForm ?? null,
      nearest_manager_id: nearestManagerId,
      manager_name_raw: body.managerNameRaw ?? null,
      start_date: kind === 'onboarding' ? body.startDate : null,
      last_day: kind === 'offboarding' ? body.lastDay : null,
      exit_reason: kind === 'offboarding' ? (body.exitReason ?? null) : null,
      exit_type: kind === 'offboarding' ? (body.exitType ?? null) : null,
      notes: body.notes ?? null,
      initiated_by: caller.userId,
    })
    .select('id')
    .single()
  if (error) fail(error.message, 400)

  const c = await loadCase(admin, created.id)
  let managerNotified = false
  if (c.manager?.email) {
    const r = await sendBoardingEmail(admin, {
      caseId: c.id,
      templateKey: 'boarding-manager-action',
      to: c.manager.email,
      recipientProfileId: c.manager.id,
      idempotencyKey: `boarding-manager-action-${c.id}`,
      templateData: {
        kind,
        caseId: c.id,
        managerFirstName: (c.manager.full_name ?? '').split(' ')[0],
        personName: personName(c),
        position: c.title,
        department: c.department,
        startDate: c.start_date,
        lastDay: c.last_day,
        deepLink: caseLink(c.id),
      },
    })
    managerNotified = r.sent
  }

  return { ok: true, caseId: c.id, managerNotified }
}

// -------------------------------------------------------- manager_submit
async function managerSubmit(admin: AdminClient, caller: Caller, body: any) {
  const c = await loadCase(admin, String(body.caseId ?? ''))
  assertCanActAsManager(caller, c)
  if (c.status !== 'awaiting_manager') fail(`Ärendet väntar inte på chef (status: ${c.status})`, 409)

  const selectedToolIds: string[] = Array.isArray(body.selectedToolIds) ? body.selectedToolIds.map(String) : []
  const optionalKeys: string[] = Array.isArray(body.optionalKeys) ? body.optionalKeys.map(String) : []
  const requireHr = c.template?.require_hr_confirm === true

  const { error } = await admin
    .from('boarding_cases')
    .update({
      selected_tool_ids: selectedToolIds,
      optional_keys: optionalKeys,
      manager_submitted_at: new Date().toISOString(),
      manager_submitted_by: caller.userId,
      notes: body.notes ?? c.notes,
      status: requireHr ? 'awaiting_hr' : c.status,
    })
    .eq('id', c.id)
  if (error) fail(error.message, 400)

  if (requireHr) {
    const hr = await resolveGroupMembers(admin, 'HR')
    for (const a of hr) {
      if (!a.email) continue
      await sendBoardingEmail(admin, {
        caseId: c.id,
        templateKey: 'boarding-hr-confirm',
        to: a.email,
        recipientProfileId: a.profile_id,
        idempotencyKey: `boarding-hr-confirm-${c.id}-${a.email}`,
        templateData: {
          kind: c.kind,
          caseId: c.id,
          recipientFirstName: a.label.split(' ')[0],
          personName: personName(c),
          position: c.title,
          startDate: c.start_date,
          lastDay: c.last_day,
          managerName: c.manager?.full_name ?? caller.fullName,
          deepLink: caseLink(c.id),
        },
      })
    }
    return { ok: true, status: 'awaiting_hr', hrNotified: hr.length }
  }

  const result = await activate(admin, await loadCase(admin, c.id))
  return { ok: true, status: 'active', ...result }
}

// ------------------------------------------------------------ hr_confirm
async function hrConfirm(admin: AdminClient, caller: Caller, body: any) {
  if (!caller.isStaff) fail('Bara HR/admin/IT kan bekräfta', 403)
  const c = await loadCase(admin, String(body.caseId ?? ''))
  if (c.status !== 'awaiting_hr' && c.status !== 'awaiting_manager') {
    fail(`Ärendet kan inte bekräftas (status: ${c.status})`, 409)
  }
  const { error } = await admin
    .from('boarding_cases')
    .update({ hr_confirmed_at: new Date().toISOString(), hr_confirmed_by: caller.userId })
    .eq('id', c.id)
  if (error) fail(error.message, 400)

  const result = await activate(admin, await loadCase(admin, c.id))
  return { ok: true, status: 'active', ...result }
}

// ---------------------------------------------------------------- cancel
async function cancelCase(admin: AdminClient, caller: Caller, body: any) {
  const c = await loadCase(admin, String(body.caseId ?? ''))
  assertCanActAsManager(caller, c)
  if (c.status === 'completed' || c.status === 'cancelled') fail(`Ärendet är redan ${c.status}`, 409)
  const reason = String(body.reason ?? '').trim()
  if (!reason) fail('Ange anledning', 400)

  const { error } = await admin
    .from('boarding_cases')
    .update({ status: 'cancelled', cancel_reason: reason, cancelled_at: new Date().toISOString() })
    .eq('id', c.id)
  if (error) fail(error.message, 400)

  const { data: openTasks } = await admin
    .from('boarding_case_tasks')
    .select('assignee_email, assignee_profile_id, assignee:profiles!boarding_case_tasks_assignee_profile_id_fkey(email, full_name)')
    .eq('case_id', c.id)
    .eq('status', 'pending')

  const recipients = new Map<string, { profileId: string | null; firstName: string }>()
  for (const t of openTasks ?? []) {
    const email = (t as any).assignee?.email || t.assignee_email
    if (email && !recipients.has(email)) {
      recipients.set(email, {
        profileId: t.assignee_profile_id ?? null,
        firstName: ((t as any).assignee?.full_name ?? '').split(' ')[0],
      })
    }
  }
  for (const [email, r] of recipients) {
    await sendBoardingEmail(admin, {
      caseId: c.id,
      templateKey: 'boarding-cancelled',
      to: email,
      recipientProfileId: r.profileId,
      idempotencyKey: `boarding-cancelled-${c.id}-${email}`,
      templateData: {
        kind: c.kind,
        caseId: c.id,
        recipientFirstName: r.firstName,
        personName: personName(c),
        cancelReason: reason,
        cancelledByName: caller.fullName ?? 'HR',
        deepLink: caseLink(c.id),
      },
    })
  }
  return { ok: true, status: 'cancelled', notified: recipients.size }
}

// -------------------------------------------------------------- activate
async function activate(admin: AdminClient, c: any) {
  const { count: existing } = await admin
    .from('boarding_case_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('case_id', c.id)

  let tasksCreated = 0
  if ((existing ?? 0) === 0) {
    const { data: templateTasks } = await admin
      .from('boarding_template_tasks')
      .select('*')
      .eq('template_id', c.template_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    const baseDate: string | null = c.kind === 'onboarding' ? c.start_date : c.last_day
    const rows: any[] = []
    for (const tt of templateTasks ?? []) {
      if (!shouldInclude(tt, c)) continue
      const deadline = baseDate ? addDays(baseDate, tt.due_offset_days ?? 0) : null
      const assignees = await resolveAssignees(admin, tt, c)
      const base = {
        case_id: c.id,
        template_task_id: tt.id,
        sort_order: tt.sort_order,
        title: tt.title,
        description: tt.description,
        category: tt.category,
        condition_key: tt.condition_key,
        deadline_date: deadline,
      }
      if (assignees.length === 0) {
        rows.push({ ...base, assignee_label: '(ej tilldelad)' })
      } else {
        for (const a of assignees) {
          rows.push({
            ...base,
            assignee_profile_id: a.profile_id,
            assignee_external_contact_id: a.external_contact_id,
            assignee_email: a.email,
            assignee_label: a.label,
          })
        }
      }
    }
    if (rows.length) {
      const { error } = await admin.from('boarding_case_tasks').insert(rows)
      if (error) fail(error.message, 500)
    }
    tasksCreated = rows.length
  }

  const { error: stErr } = await admin.from('boarding_cases').update({ status: 'active' }).eq('id', c.id)
  if (stErr) fail(stErr.message, 500)

  // Ett samlat mejl per mottagare
  const { data: tasks } = await admin
    .from('boarding_case_tasks')
    .select('*, assignee:profiles!boarding_case_tasks_assignee_profile_id_fkey(full_name, email)')
    .eq('case_id', c.id)
    .eq('status', 'pending')
    .order('sort_order', { ascending: true })

  const byEmail = new Map<string, any[]>()
  for (const t of tasks ?? []) {
    const email = (t as any).assignee?.email || t.assignee_email
    if (!email) continue
    if (!byEmail.has(email)) byEmail.set(email, [])
    byEmail.get(email)!.push(t)
  }

  let emailsSent = 0
  for (const [email, list] of byEmail) {
    const first = list[0]
    const label: string = (first as any).assignee?.full_name || first.assignee_label || ''
    const r = await sendBoardingEmail(admin, {
      caseId: c.id,
      templateKey: 'boarding-owner-tasks',
      to: email,
      recipientProfileId: first.assignee_profile_id ?? null,
      idempotencyKey: `boarding-owner-tasks-${c.id}-${email}`,
      templateData: {
        kind: c.kind,
        caseId: c.id,
        recipientFirstName: label.split(' ')[0],
        personName: personName(c),
        position: c.title,
        department: c.department,
        startDate: c.start_date,
        lastDay: c.last_day,
        managerName: c.manager?.full_name,
        costCentre: c.cost_centre,
        tasks: list.map((t) => ({ title: t.title, description: t.description, deadline: t.deadline_date })),
        deepLink: caseLink(c.id),
      },
    })
    if (r.sent) emailsSent++
  }

  return { tasksCreated, emailsSent, recipients: byEmail.size }
}

function shouldInclude(tt: any, c: any): boolean {
  if (tt.is_system_access) {
    const selected: string[] = c.selected_tool_ids ?? []
    return !!tt.assignee_tool_id && selected.includes(tt.assignee_tool_id)
  }
  const key: string | null = tt.condition_key
  if (!key) return true
  if (AUTO_KEYS.has(key)) {
    if (key === 'location_stockholm') return String(c.location ?? '').toLowerCase().includes('stockholm')
    if (key === 'trigger_manual') return c.trigger_source !== 'heartpace'
  }
  const chosen: string[] = c.optional_keys ?? []
  return chosen.includes(key)
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const profileAssignee = (p: any): Assignee => ({
  profile_id: p.id,
  external_contact_id: null,
  email: p.email ?? null,
  label: p.full_name ?? p.email ?? '',
})
const externalAssignee = (e: any): Assignee => ({
  profile_id: null,
  external_contact_id: e.id,
  email: e.email ?? null,
  label: e.company_name ? `${e.full_name} (${e.company_name})` : e.full_name,
})

async function resolveGroupMembers(admin: AdminClient, groupName: string): Promise<Assignee[]> {
  const { data: group } = await admin.from('groups').select('id').ilike('name', groupName).maybeSingle()
  if (!group) return []
  const { data: members } = await admin.from('group_members').select('user_id').eq('group_id', group.id)
  const userIds = (members ?? []).map((m: any) => m.user_id)
  if (!userIds.length) return []
  const { data: profiles } = await admin.from('profiles').select('id, full_name, email').in('user_id', userIds)
  return (profiles ?? []).map(profileAssignee)
}

async function resolveAssignees(admin: AdminClient, tt: any, c: any): Promise<Assignee[]> {
  switch (tt.assignee_source) {
    case 'static_profile': {
      if (!tt.assignee_profile_id) return []
      const { data } = await admin.from('profiles').select('id, full_name, email').eq('id', tt.assignee_profile_id).maybeSingle()
      return data ? [profileAssignee(data)] : []
    }
    case 'tool_owner': {
      if (!tt.assignee_tool_id) return []
      const { data } = await admin
        .from('tool_owners')
        .select('profile:profiles!tool_owners_profile_id_fkey(id, full_name, email), external:external_contacts!tool_owners_external_contact_id_fkey(id, full_name, company_name, email, is_active)')
        .eq('tool_id', tt.assignee_tool_id)
      const out: Assignee[] = []
      for (const r of (data ?? []) as any[]) {
        if (r.profile) out.push(profileAssignee(r.profile))
        else if (r.external && r.external.is_active !== false) out.push(externalAssignee(r.external))
      }
      return out
    }
    case 'area_owner': {
      if (!tt.assignee_area_id) return []
      const { data } = await admin
        .from('responsibility_owners')
        .select('profile:profiles!responsibility_owners_profile_id_fkey(id, full_name, email)')
        .eq('area_id', tt.assignee_area_id)
      return ((data ?? []) as any[]).filter((r) => r.profile).map((r) => profileAssignee(r.profile))
    }
    case 'group':
      return tt.assignee_group_name ? resolveGroupMembers(admin, tt.assignee_group_name) : []
    case 'nearest_manager':
      return c.manager ? [profileAssignee(c.manager)] : []
    case 'external_contact': {
      if (!tt.assignee_external_contact_id) return []
      const { data } = await admin
        .from('external_contacts')
        .select('id, full_name, company_name, email, is_active')
        .eq('id', tt.assignee_external_contact_id)
        .maybeSingle()
      return data && data.is_active !== false ? [externalAssignee(data)] : []
    }
  }
  return []
}
