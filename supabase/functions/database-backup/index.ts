import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRIMARY_ORIGIN = "https://intra.handelsfastigheter.se";

const isAllowedOrigin = (origin: string | null) => {
  if (!origin) return false;
  return (
    origin === PRIMARY_ORIGIN ||
    origin === "https://handelsfastigheter.lovable.app" ||
    origin.endsWith(".lovableproject.com") ||
    origin.endsWith(".lovable.app") ||
    origin === "http://localhost:5173"
  );
};

const getCorsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : PRIMARY_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Vary": "Origin",
});

const TABLES = [
  "profiles",
  "user_roles",
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
  "user_tool_favorites",
  "document_folders",
  "document_files",
  "notifications",
  "recognitions",
  "celebration_comments",
  "ceo_blog",
  "org_chart_settings",
  "shared_passwords",
  "shared_password_groups",
  "password_access_log",
  "planner_boards",
  "planner_columns",
  "planner_cards",
  "planner_checklists",
  "planner_checklist_items",
  "planner_card_comments",
  "planner_card_attachments",
  "planner_activity_log",
  "workwear_orders",
  "content_index",
  "email_send_log",
  "email_send_state",
  "email_unsubscribe_tokens",
  "suppressed_emails",
];

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

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

    // Check admin role via has_role RPC (includes group-based roles)
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: groupRole } = await adminClient.rpc("has_role", {
      _user_id: claims.user.id,
      _role: "admin",
    });

    if (!groupRole) {
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
