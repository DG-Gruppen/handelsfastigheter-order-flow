import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://intra.handelsfastigheter.se",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { season_label, deadline } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get all user_ids from profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id");

    if (profilesError) throw profilesError;

    const deadlineText = deadline
      ? ` Sista beställningsdag: ${new Date(deadline).toLocaleDateString("sv-SE")}.`
      : "";

    // Insert notifications for all users
    const notifications = (profiles || []).map((p: { user_id: string }) => ({
      user_id: p.user_id,
      title: "Ny beställningsrunda – Profilkläder",
      message: `Beställningsrundan för ${season_label} är nu öppen!${deadlineText}`,
      type: "workwear_season",
    }));

    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, notified: notifications.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error notifying workwear season:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
