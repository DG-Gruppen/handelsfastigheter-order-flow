import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://intra.handelsfastigheter.se",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "profiles",
  "groups",
  "group_members",
  "modules",
  "module_permissions",
  "module_role_access",
  "module_activity_log",
  "departments",
  "categories",
  "category_departments",
  "order_types",
  "order_type_departments",
  "orders",
  "order_items",
  "order_systems",
  "systems",
  "news",
  "kb_categories",
  "kb_articles",
  "kb_videos",
  "it_faq",
  "tools",
  "document_folders",
  "document_files",
  "notifications",
  "recognitions",
  "ceo_blog",
  "org_chart_settings",
  "planner_boards",
  "planner_columns",
  "planner_cards",
  "planner_checklists",
  "planner_checklist_items",
  "planner_card_comments",
  "planner_card_attachments",
  "planner_activity_log",
  "content_index",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getUser();
    if (claimsErr || !claims?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", claims.user.id);

    // Also check group-based admin role
    const { data: groupRole } = await adminClient.rpc("has_role", {
      _user_id: claims.user.id,
      _role: "admin",
    });

    const isAdmin =
      roleData?.some((r: any) => r.role === "admin") || groupRole === true;

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Export all tables
    const backup: Record<string, any> = {
      _meta: {
        created_at: new Date().toISOString(),
        created_by: claims.user.email,
        tables: TABLES,
      },
    };

    for (const table of TABLES) {
      const { data, error } = await adminClient
        .from(table)
        .select("*")
        .limit(10000);
      backup[table] = {
        count: data?.length ?? 0,
        rows: data ?? [],
        error: error?.message ?? null,
      };
    }

    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    console.error("Backup error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
