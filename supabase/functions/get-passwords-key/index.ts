/**
 * Returns the passwords encryption key to authenticated users.
 * JWT verification is handled by Supabase (verify_jwt = true in config.toml).
 * Set PASSWORDS_ENCRYPTION_KEY in Supabase project secrets.
 */

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
