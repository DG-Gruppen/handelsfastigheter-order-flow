import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://intra.handelsfastigheter.se",
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

  // Create client with caller's token to get their identity
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

  // Verify caller has 'it' role using service client
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: roleCheck } = await adminClient
    .from("user_roles")
    .select("id")
    .eq("user_id", callerUser.id)
    .eq("role", "it")
    .maybeSingle();

  if (!roleCheck) {
    return new Response(JSON.stringify({ error: "Forbidden: requires IT role" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get target user
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

  // Generate a magic link for the target user (without sending email)
  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: targetProfile.email,
    });

  if (linkError || !linkData) {
    console.error("Failed to generate impersonation link:", linkError);
    return new Response(
      JSON.stringify({ error: "Failed to generate session" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Extract the token hash from the generated link
  const props = linkData.properties;

  return new Response(
    JSON.stringify({
      token_hash: props.hashed_token,
      email: targetProfile.email,
      full_name: targetProfile.full_name,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
