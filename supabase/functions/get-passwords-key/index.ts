/**
 * Returns the passwords encryption key to authenticated users
 * who belong to at least one group linked to a shared password.
 * JWT verification is handled by Supabase (verify_jwt = true in config.toml).
 * Set PASSWORDS_ENCRYPTION_KEY in Supabase project secrets.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://intra.handelsfastigheter.se";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify caller identity
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check that the user belongs to at least one group that has access to any password
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: hasAccess } = await adminClient.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

  const { data: hasItRole } = await adminClient.rpc("has_role", {
    _user_id: user.id,
    _role: "it",
  });

  // Admin and IT always get the key
  let allowed = hasAccess === true || hasItRole === true;

  if (!allowed) {
    // Check if user belongs to any group linked to a shared password
    const { count } = await adminClient
      .from("shared_password_groups")
      .select("id", { count: "exact", head: true })
      .in(
        "group_id",
        // Subquery: groups the user belongs to
        (await adminClient
          .from("group_members")
          .select("group_id")
          .eq("user_id", user.id)
        ).data?.map((gm: any) => gm.group_id) ?? []
      );

    allowed = (count ?? 0) > 0;
  }

  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "No password access" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const key = Deno.env.get("PASSWORDS_ENCRYPTION_KEY");
  if (!key) {
    return new Response(
      JSON.stringify({ error: "Encryption key not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ key }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
