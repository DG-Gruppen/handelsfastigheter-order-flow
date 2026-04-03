import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, password, full_name } = await req.json();

    if (!token || typeof token !== "string" || token.length < 10) {
      return new Response(JSON.stringify({ error: "Ogiltig token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Lösenordet måste vara minst 6 tecken" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: "Ange ditt namn" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up invite
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("external_invites")
      .select("*")
      .eq("token", token)
      .single();

    if (inviteErr || !invite) {
      return new Response(
        JSON.stringify({ error: "Inbjudan hittades inte" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (invite.accepted_at) {
      return new Response(
        JSON.stringify({ error: "Denna inbjudan har redan använts" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Inbjudan har gått ut" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create auth user with auto-confirm
    const { data: authData, error: authErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: invite.email,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          is_external: true,
        },
      });

    if (authErr) {
      // If user already exists, try to sign them in instead
      if (authErr.message?.includes("already been registered")) {
        return new Response(
          JSON.stringify({
            error: "Ett konto med denna e-post finns redan. Logga in istället.",
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      throw authErr;
    }

    const userId = authData.user.id;

    // Update profile to mark as external
    // The handle_new_user trigger creates the profile, but we need to update it
    // Small delay to let the trigger fire
    await new Promise((r) => setTimeout(r, 500));

    await supabaseAdmin
      .from("profiles")
      .update({
        is_external: true,
        full_name: full_name.trim(),
      })
      .eq("user_id", userId);

    // Add to groups
    if (invite.group_ids && invite.group_ids.length > 0) {
      const groupInserts = invite.group_ids.map((gid: string) => ({
        user_id: userId,
        group_id: gid,
      }));
      await supabaseAdmin.from("group_members").insert(groupInserts);
    }

    // Set module permissions based on invite
    if (invite.module_slugs && invite.module_slugs.length > 0) {
      // Look up module IDs for the slugs
      const { data: modules } = await supabaseAdmin
        .from("modules")
        .select("id, slug")
        .in("slug", invite.module_slugs);

      if (modules && modules.length > 0) {
        const permInserts = modules.map((m: { id: string; slug: string }) => ({
          module_id: m.id,
          grantee_type: "user",
          grantee_id: userId,
          can_view: true,
          can_edit: false,
          can_delete: false,
          is_owner: false,
          created_by: invite.invited_by,
        }));
        await supabaseAdmin.from("module_permissions").insert(permInserts);
      }
    }

    // Mark invite as accepted
    await supabaseAdmin
      .from("external_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    return new Response(
      JSON.stringify({ success: true, email: invite.email }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("accept-external-invite error:", err);
    return new Response(
      JSON.stringify({ error: "Ett oväntat fel uppstod" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
