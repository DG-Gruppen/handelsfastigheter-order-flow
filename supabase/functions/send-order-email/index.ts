// Sends the order-lifecycle emails (approval request, approved, rejected,
// delivered, helpdesk notice) through Lovable's managed email API.
// Called by the app after an order event; only signed-in users may call it.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendAppEmail } from '../_shared/send-app-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Only order-related templates may be sent from this endpoint.
const ALLOWED_TEMPLATES = new Set([
  'new-order-approval',
  'order-rejected',
  'order-approved',
  'order-delivered',
  'helpdesk-order',
])

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
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice('Bearer '.length).trim()
  if (token !== SERVICE_KEY) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data, error } = await userClient.auth.getUser()
    if (error || !data?.user) return json({ error: 'Unauthorized' }, 401)
  }

  let templateName: string
  let recipientEmail: string
  let idempotencyKey: string | undefined
  let templateData: Record<string, unknown> = {}
  try {
    const body = await req.json()
    templateName = String(body.templateName ?? '')
    recipientEmail = String(body.recipientEmail ?? '')
    idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : undefined
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!ALLOWED_TEMPLATES.has(templateName)) {
    return json({ error: 'Unknown template' }, 400)
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
    return json({ error: 'Valid recipientEmail is required' }, 400)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)
  const result = await sendAppEmail(templateName, recipientEmail, {
    templateData,
    idempotencyKey,
    admin,
  })

  if (result.sent) return json({ success: true })
  if (result.reason === 'recipient_suppressed') {
    return json({ success: false, reason: 'recipient_suppressed' })
  }
  return json({ error: 'Failed to send email' }, 500)
})
