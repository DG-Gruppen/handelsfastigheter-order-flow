import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify caller's JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const callerToken = authHeader.slice("Bearer ".length).trim();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${callerToken}` } },
  });

  const {
    data: { user: callerUser },
    error: userError,
  } = await callerClient.auth.getUser();

  if (userError || !callerUser) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify caller has 'it' or 'admin' role
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  const [{ data: isIt }, { data: isAdmin }] = await Promise.all([
    adminClient.rpc("has_role", { _user_id: callerUser.id, _role: "it" }),
    adminClient.rpc("has_role", { _user_id: callerUser.id, _role: "admin" }),
  ]);

  if (!isIt && !isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden: requires IT or admin role" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { target_user_id } = await req.json();
  if (!target_user_id) {
    return new Response(JSON.stringify({ error: "Missing target_user_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get target user's email
  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("email, full_name")
    .eq("user_id", target_user_id)
    .single();

  if (!targetProfile?.email) {
    return new Response(JSON.stringify({ error: "Target user not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Generate magic link and verify it server-side to get session tokens
  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: targetProfile.email,
    });

  if (linkError || !linkData) {
    console.error("Failed to generate link:", linkError);
    return new Response(
      JSON.stringify({ error: "Failed to generate session" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify the OTP server-side immediately to get session tokens
  const tokenHash = linkData.properties.hashed_token;
  const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anonKey,
    },
    body: JSON.stringify({
      token_hash: tokenHash,
      type: "magiclink",
    }),
  });

  if (!verifyResponse.ok) {
    const errBody = await verifyResponse.text();
    console.error("Verify failed:", verifyResponse.status, errBody);
    return new Response(
      JSON.stringify({ error: "Failed to create session" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const session = await verifyResponse.json();

  return new Response(
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      full_name: targetProfile.full_name,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
