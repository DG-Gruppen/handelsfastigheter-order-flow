// On-/offboarding v2: alla statusövergångar för ett ärende.
//
//   create          staff/chef skapar ärende (manuellt eller simulerad Heartpace-post)
//                   → status awaiting_manager, mejl till närmaste chef
//   preview         visar vilka som får vilka uppgifter om ärendet aktiveras nu –
//                   samma logik som aktiveringen, men skriver ingenting
//   manager_submit  chefen väljer system + "om aktuellt" och skickar in
//                   → awaiting_hr om mallen kräver HR-bekräftelse, annars aktivering
//   hr_confirm      HR/admin/IT bekräftar → aktivering
//   cancel          staff eller chef avbryter → mejl till alla med öppna uppgifter
//
// Aktivering = mallen snapshottas till boarding_case_tasks (bara uppgifter
// vars villkor är uppfyllda), ansvariga resolvas, ett samlat mejl per mottagare.
// En mallrad med assignee_source = 'group' blir EN uppgift märkt med gruppnamnet;
// mejlet går till alla medlemmar och vem som helst i gruppen kan bocka av.
// Heartpace-intaget (senare etapp) anropar samma create-väg.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendBoardingEmail, boardingEmailRedirect, type BoardingDb } from '../_shared/boarding-email.ts'

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
  group_name: string | null
  email: string | null
  label: string
}

interface PlannedTask {
  case_id: string
  template_task_id: string
  sort_order: number
  title: string
  description: string | null
  category: string | null
  condition_key: string | null
  deadline_date: string | null
  assignee_profile_id: string | null
  assignee_external_contact_id: string | null
  assignee_group_name: string | null
  assignee_email: string | null
  assignee_label: string
}

interface Recipient {
  email: string
  profileId: string | null
  label: string
  firstName: string
  // Varför mottagaren får mejlet: egna uppgifter och/eller gruppens
  viaGroups: string[]
  tasks: { title: string; description: string | null; deadline: string | null }[]
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
      case 'preview':
        return json(await previewCase(admin, caller, body))
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
const firstNameOf = (label: string | null | undefined) => (label ?? '').split(' ')[0]

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
        managerFirstName: firstNameOf(c.manager.full_name),
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

// --------------------------------------------------------------- preview
// Vad skulle gå ut om ärendet aktiverades nu? Chefens val kan skickas med
// (selectedToolIds, optionalKeys) för att förhandsvisa innan inskick.
async function previewCase(admin: AdminClient, caller: Caller, body: any) {
  const c = await loadCase(admin, String(body.caseId ?? ''))
  assertCanActAsManager(caller, c)

  const proposed = {
    ...c,
    selected_tool_ids: Array.isArray(body.selectedToolIds) ? body.selectedToolIds.map(String) : c.selected_tool_ids,
    optional_keys: Array.isArray(body.optionalKeys) ? body.optionalKeys.map(String) : c.optional_keys,
  }

  const { count: existing } = await admin
    .from('boarding_case_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('case_id', c.id)

  // Redan aktiverat ärende → visa det som faktiskt ligger, annars planen
  let planned: PlannedTask[]
  if ((existing ?? 0) > 0) {
    const { data } = await admin.from('boarding_case_tasks').select('*').eq('case_id', c.id).eq('status', 'pending').order('sort_order')
    planned = (data ?? []) as PlannedTask[]
  } else {
    planned = await planTasks(admin, proposed)
  }

  const recipients = await recipientsFor(admin, planned)
  const unassigned = planned.filter((t) => !t.assignee_profile_id && !t.assignee_external_contact_id && !t.assignee_group_name).map((t) => t.title)

  return {
    ok: true,
    alreadyActivated: (existing ?? 0) > 0,
    totalTasks: planned.length,
    redirect: boardingEmailRedirect(),
    recipients: recipients.map((r) => ({
      label: r.label,
      email: r.email,
      viaGroups: r.viaGroups,
      count: r.tasks.length,
      tasks: r.tasks.map((t) => t.title),
    })),
    unassigned,
  }
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
          recipientFirstName: firstNameOf(a.label),
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
    .select('*')
    .eq('case_id', c.id)
    .eq('status', 'pending')

  const recipients = await recipientsFor(admin, (openTasks ?? []) as PlannedTask[])
  for (const r of recipients) {
    await sendBoardingEmail(admin, {
      caseId: c.id,
      templateKey: 'boarding-cancelled',
      to: r.email,
      recipientProfileId: r.profileId,
      idempotencyKey: `boarding-cancelled-${c.id}-${r.email}`,
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
  return { ok: true, status: 'cancelled', notified: recipients.length }
}

// -------------------------------------------------------------- activate
async function activate(admin: AdminClient, c: any) {
  const { count: existing } = await admin
    .from('boarding_case_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('case_id', c.id)

  let tasksCreated = 0
  if ((existing ?? 0) === 0) {
    const rows = await planTasks(admin, c)
    if (rows.length) {
      const { error } = await admin.from('boarding_case_tasks').insert(rows)
      if (error) fail(error.message, 500)
    }
    tasksCreated = rows.length
  }

  const { error: stErr } = await admin.from('boarding_cases').update({ status: 'active' }).eq('id', c.id)
  if (stErr) fail(stErr.message, 500)

  // Ett samlat mejl per mottagare (gruppuppgifter går till varje medlem)
  const { data: tasks } = await admin
    .from('boarding_case_tasks')
    .select('*')
    .eq('case_id', c.id)
    .eq('status', 'pending')
    .order('sort_order', { ascending: true })

  const recipients = await recipientsFor(admin, (tasks ?? []) as PlannedTask[])
  let emailsSent = 0
  for (const r of recipients) {
    const res = await sendBoardingEmail(admin, {
      caseId: c.id,
      templateKey: 'boarding-owner-tasks',
      to: r.email,
      recipientProfileId: r.profileId,
      idempotencyKey: `boarding-owner-tasks-${c.id}-${r.email}`,
      templateData: {
        kind: c.kind,
        caseId: c.id,
        recipientFirstName: r.firstName,
        personName: personName(c),
        position: c.title,
        department: c.department,
        startDate: c.start_date,
        lastDay: c.last_day,
        managerName: c.manager?.full_name,
        costCentre: c.cost_centre,
        tasks: r.tasks,
        deepLink: caseLink(c.id),
      },
    })
    if (res.sent) emailsSent++
  }

  return { tasksCreated, emailsSent, recipients: recipients.length }
}

// Mallen → uppgiftsrader för ett ärende, enligt dess val och villkor.
// Skriver ingenting – används av både aktivering och förhandsvisning.
async function planTasks(admin: AdminClient, c: any): Promise<PlannedTask[]> {
  const { data: templateTasks } = await admin
    .from('boarding_template_tasks')
    .select('*')
    .eq('template_id', c.template_id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const baseDate: string | null = c.kind === 'onboarding' ? c.start_date : c.last_day
  const rows: PlannedTask[] = []
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
      rows.push({
        ...base,
        assignee_profile_id: null,
        assignee_external_contact_id: null,
        assignee_group_name: null,
        assignee_email: null,
        assignee_label: '(ej tilldelad)',
      })
      continue
    }
    for (const a of assignees) {
      rows.push({
        ...base,
        assignee_profile_id: a.profile_id,
        assignee_external_contact_id: a.external_contact_id,
        assignee_group_name: a.group_name,
        assignee_email: a.email,
        assignee_label: a.label,
      })
    }
  }
  return rows
}

// Uppgifter → mottagare med varsin lista. Gruppuppgifter fläktas ut till
// medlemmarna; en person som både har egna uppgifter och gruppens får ett mejl.
async function recipientsFor(admin: AdminClient, tasks: PlannedTask[]): Promise<Recipient[]> {
  const byEmail = new Map<string, Recipient>()
  const add = (email: string, profileId: string | null, label: string, viaGroup: string | null, t: PlannedTask) => {
    const key = email.toLowerCase()
    let r = byEmail.get(key)
    if (!r) {
      r = { email, profileId, label, firstName: firstNameOf(label), viaGroups: [], tasks: [] }
      byEmail.set(key, r)
    }
    if (viaGroup && !r.viaGroups.includes(viaGroup)) r.viaGroups.push(viaGroup)
    r.tasks.push({ title: t.title, description: t.description, deadline: t.deadline_date })
  }

  const profileIds = Array.from(new Set(tasks.map((t) => t.assignee_profile_id).filter(Boolean))) as string[]
  const profileById = new Map<string, any>()
  if (profileIds.length) {
    const { data } = await admin.from('profiles').select('id, full_name, email').in('id', profileIds)
    for (const p of data ?? []) profileById.set(p.id, p)
  }
  const groupMembers = new Map<string, Assignee[]>()

  for (const t of tasks) {
    if (t.assignee_group_name) {
      const key = t.assignee_group_name.toLowerCase()
      if (!groupMembers.has(key)) groupMembers.set(key, await resolveGroupMembers(admin, t.assignee_group_name))
      for (const m of groupMembers.get(key)!) {
        if (m.email) add(m.email, m.profile_id, m.label, t.assignee_group_name, t)
      }
      continue
    }
    const p = t.assignee_profile_id ? profileById.get(t.assignee_profile_id) : null
    const email = p?.email || t.assignee_email
    if (!email) continue
    add(email, t.assignee_profile_id ?? null, p?.full_name || t.assignee_label || email, null, t)
  }
  return Array.from(byEmail.values())
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
  group_name: null,
  email: p.email ?? null,
  label: p.full_name ?? p.email ?? '',
})
const externalAssignee = (e: any): Assignee => ({
  profile_id: null,
  external_contact_id: e.id,
  group_name: null,
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
    case 'group': {
      // EN uppgift för hela gruppen – bara om gruppen finns och har medlemmar
      if (!tt.assignee_group_name) return []
      const members = await resolveGroupMembers(admin, tt.assignee_group_name)
      if (!members.length) return []
      return [{
        profile_id: null,
        external_contact_id: null,
        group_name: tt.assignee_group_name,
        email: null,
        label: `${tt.assignee_group_name} (grupp)`,
      }]
    }
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
