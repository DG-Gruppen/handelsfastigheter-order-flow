import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://intra.handelsfastigheter.se",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { users: gwUsers } = await req.json();

    if (!gwUsers || !Array.isArray(gwUsers)) {
      return new Response(JSON.stringify({ error: "Invalid data format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, full_name, email, phone");

    if (profilesError) throw profilesError;

    const results: any[] = [];

    for (const gwUser of gwUsers) {
      const firstName = gwUser["First Name [Required]"]?.trim() || "";
      const lastName = gwUser["Last Name [Required]"]?.trim() || "";
      const gwFullName = `${firstName} ${lastName}`.trim();
      const gwEmail = gwUser["Email Address [Required]"]?.trim() || "";
      const gwPhone = gwUser["Recovery Phone [MUST BE IN THE E.164 FORMAT]"]?.trim() || "";
      const gwWorkPhone = gwUser["Work Phone"]?.trim() || "";
      const gwMobilePhone = gwUser["Mobile Phone"]?.trim() || "";
      const gwDepartment = gwUser["Department"]?.trim() || "";
      const gwTitle = gwUser["Employee Title"]?.trim() || "";

      // Pick best phone: recovery > mobile > work
      const phone = gwPhone || gwMobilePhone || gwWorkPhone || "";

      if (!gwEmail || !gwFullName) continue;

      // Skip service/shared accounts
      const status = gwUser["Status [READ ONLY]"]?.trim();
      if (status !== "Active") continue;

      // Match by name (case-insensitive, ignoring accents is tricky so we do exact match)
      const matchedProfile = profiles?.find((p) => {
        // Try exact name match
        if (p.full_name.toLowerCase() === gwFullName.toLowerCase()) return true;
        // Try email prefix match (e.g., albin.ostman from both demo and real)
        const profilePrefix = p.email.split("@")[0];
        const gwPrefix = gwEmail.split("@")[0];
        if (profilePrefix === gwPrefix) return true;
        return false;
      });

      if (!matchedProfile) {
        results.push({ name: gwFullName, email: gwEmail, status: "no_match" });
        continue;
      }

      // Build update object
      const updates: Record<string, any> = {};
      if (gwEmail && matchedProfile.email !== gwEmail) updates.email = gwEmail;
      if (phone && matchedProfile.phone !== phone) updates.phone = phone;

      if (Object.keys(updates).length === 0) {
        results.push({ name: gwFullName, email: gwEmail, status: "no_changes" });
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update(updates)
        .eq("id", matchedProfile.id);

      if (updateError) {
        results.push({ name: gwFullName, email: gwEmail, status: "error", error: updateError.message });
      } else {
        results.push({ name: gwFullName, email: gwEmail, status: "updated", updates });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
