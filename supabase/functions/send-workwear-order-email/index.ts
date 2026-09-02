// Notifies the workwear inbox when an employee submits a profile-clothing order.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendAppEmail } from '../_shared/send-app-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const FALLBACK_IT_EMAIL = 'it@handelsfastigheter.se'

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData?.user) return json({ error: 'Unauthorized' }, 401)
  const user = userData.user

  let seasonLabel = ''
  let notes = ''
  let items: Array<Record<string, unknown>> = []
  try {
    const body = await req.json()
    seasonLabel = String(body.seasonLabel ?? '').slice(0, 100)
    notes = String(body.notes ?? '').slice(0, 2000)
    if (Array.isArray(body.items)) {
      items = body.items.slice(0, 50).map((i: Record<string, unknown>) => ({
        productName: String(i.productName ?? '').slice(0, 200),
        colorLabel: String(i.colorLabel ?? '').slice(0, 100),
        size: String(i.size ?? '').slice(0, 50),
        quantity: Number(i.quantity ?? 1),
        url: typeof i.url === 'string' && i.url.startsWith('https://') ? i.url : undefined,
      }))
    }
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (items.length === 0) return json({ error: 'items is required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  // Recipient and sender identity come from trusted data, never the browser.
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: workwearSetting } = await admin
    .from('org_chart_settings')
    .select('setting_value')
    .eq('setting_key', 'workwear_email')
    .maybeSingle()

  let recipient = workwearSetting?.setting_value as string | undefined
  if (!recipient) {
    const { data: itSetting } = await admin
      .from('org_chart_settings')
      .select('setting_value')
      .eq('setting_key', 'it_contact_email')
      .maybeSingle()
    recipient = (itSetting?.setting_value as string | undefined) || FALLBACK_IT_EMAIL
  }

  const employeeEmail = (profile?.email as string | undefined) || user.email || ''

  const result = await sendAppEmail('workwear-order', recipient, {
    idempotencyKey: `workwear-order-${user.id}-${new Date().toISOString().slice(0, 16)}`,
    replyTo: employeeEmail || undefined,
    templateData: {
      employeeName: (profile?.full_name as string | undefined) || 'Anställd',
      employeeEmail,
      seasonLabel,
      items,
      notes,
    },
    admin,
  })

  if (result.sent) return json({ success: true })
  if (result.reason === 'recipient_suppressed') {
    return json({ success: false, reason: 'recipient_suppressed' })
  }
  return json({ error: 'Failed to send email' }, 500)
})
