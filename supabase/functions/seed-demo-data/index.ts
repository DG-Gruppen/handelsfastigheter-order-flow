import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const demoUsers = [
  { email: "anna.lindstrom@demo.example.com", password: "demo1234", full_name: "Anna Lindström", department: "IT", phone: "+46 70 123 4567", roles: ["admin"] },
  { email: "erik.johansson@demo.example.com", password: "demo1234", full_name: "Erik Johansson", department: "Ekonomi", phone: "+46 70 234 5678", roles: ["manager"] },
  { email: "maria.svensson@demo.example.com", password: "demo1234", full_name: "Maria Svensson", department: "HR", phone: "+46 70 345 6789", roles: ["manager"] },
  { email: "johan.karlsson@demo.example.com", password: "demo1234", full_name: "Johan Karlsson", department: "Försäljning", phone: "+46 70 456 7890", roles: ["employee"] },
  { email: "sara.nilsson@demo.example.com", password: "demo1234", full_name: "Sara Nilsson", department: "IT", phone: "+46 70 567 8901", roles: ["employee"] },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results = [];

    for (const user of demoUsers) {
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const exists = existingUsers?.users?.find((u: any) => u.email === user.email);
      
      if (exists) {
        results.push({ email: user.email, status: "already_exists" });
        continue;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.full_name },
      });

      if (authError) {
        results.push({ email: user.email, status: "error", error: authError.message });
        continue;
      }

      const userId = authData.user.id;

      // Update profile with department and phone
      await supabaseAdmin.from("profiles").update({
        department: user.department,
        phone: user.phone,
      }).eq("user_id", userId);

      // Add roles
      for (const role of user.roles) {
        await supabaseAdmin.from("user_roles").insert({
          user_id: userId,
          role,
        });
      }

      results.push({ email: user.email, status: "created", roles: user.roles });
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
