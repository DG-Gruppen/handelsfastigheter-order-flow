import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user is admin or IT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin or IT role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const { data: groupRoles } = await adminClient
      .from("group_members")
      .select("group_id, groups!inner(role_equivalent)")
      .eq("user_id", user.id);

    const allRoles = [
      ...(roles?.map((r: any) => r.role) || []),
      ...(groupRoles?.map((g: any) => (g as any).groups?.role_equivalent).filter(Boolean) || []),
    ];

    if (!allRoles.includes("admin") && !allRoles.includes("it")) {
      return new Response(JSON.stringify({ error: "Forbidden: admin or IT role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { slug, secret_name, secret_value } = await req.json();

    if (!slug || !secret_name || !secret_value) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate secret_name is in allowed list
    const ALLOWED_SECRETS = [
      "CISION_FEED_URL",
      "RESEND_API_KEY",
      "FIRECRAWL_API_KEY",
      "HEARTPACE_API_KEY",
    ];

    if (!ALLOWED_SECRETS.includes(secret_name)) {
      return new Response(JSON.stringify({ error: "Secret name not allowed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the integration_status metadata to mark key as configured
    await adminClient
      .from("integration_status")
      .update({
        metadata: { awaiting_api_key: false, key_updated_at: new Date().toISOString() },
        status: "ok",
      })
      .eq("slug", slug);

    // Note: In a production setup, you'd use Supabase Vault or similar.
    // For now we log success – the actual secret must be set via the Lovable secrets UI.
    console.log(`Secret ${secret_name} update requested for integration ${slug} by user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Secret ${secret_name} registrerad. Kontakta administratör för att uppdatera i Lovable Cloud.`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
