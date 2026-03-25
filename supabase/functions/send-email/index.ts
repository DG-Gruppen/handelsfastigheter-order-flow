import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_ORIGIN = 'https://intra.handelsfastigheter.se'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Simple in-memory rate limiter: max 20 emails per minute per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Verify JWT and extract user
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey)

  // Check if this is a service-role call (system/internal) — skip user validation
  const isServiceRole = token === supabaseServiceKey
  let rateLimitKey = 'service'

  if (!isServiceRole) {
    // Validate the user's JWT
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    rateLimitKey = claimsData.claims.sub as string
  }

  // Rate limiting
  if (!checkRateLimit(rateLimitKey)) {
    return new Response(
      JSON.stringify({ error: 'För många förfrågningar. Försök igen om en stund.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'RESEND_API_KEY is not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { to, subject, html, text, from, reply_to } = await req.json()

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, and html or text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailPayload: Record<string, unknown> = {
      from: from || 'IT Handelsfastigheter <noreply@it.handelsfastigheter.se>',
      to: Array.isArray(to) ? to : [to],
      subject,
    }

    if (html) emailPayload.html = html
    if (text) emailPayload.text = text
    if (reply_to) emailPayload.reply_to = reply_to

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData)
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: resendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log to email_send_log
    await adminClient.from('email_send_log').insert({
      message_id: resendData.id,
      template_name: 'resend',
      recipient_email: Array.isArray(to) ? to[0] : to,
      status: 'sent',
    })

    return new Response(
      JSON.stringify({ success: true, id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ error: 'An error occurred while sending the email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
