import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const PAGE = 1000;
const SIGNED_URL_SECONDS = 7 * 24 * 3600;
// Platform-managed env vars that are recreated automatically on any Supabase host.
const PLATFORM_ENV = /^(SUPABASE_|DENO_|SB_|PATH$|HOME$|HOSTNAME$|PWD$|LANG$|TZ$|EDGE_|AWS_|LOVABLE_API_KEY$)/;

async function dumpTable(client: SupabaseClient, table: string) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(table).select("*").range(from, from + PAGE - 1);
    if (error) return { count: rows.length, rows, error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { count: rows.length, rows, error: null };
}

async function listBucket(client: SupabaseClient, bucket: string, prefix = ""): Promise<any[]> {
  const out: any[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error || !data) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await listBucket(client, bucket, path)));
      else out.push({ path, size: item.metadata?.size ?? null, mimetype: item.metadata?.mimetype ?? null, updated_at: item.updated_at });
    }
    if (data.length < PAGE) break;
  }
  return out;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getUser();
    if (claimsErr || !claims?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: claims.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden: admin only" }, 403);

    // 1. Schema (tables, columns, constraints, indexes, enums, functions, triggers, policies, cron)
    const { data: schema, error: schemaErr } = await admin.rpc("backup_schema_manifest");
    if (schemaErr) throw new Error(`Schema: ${schemaErr.message}`);
    const tableNames: string[] = (schema as any).tables ?? [];

    // 2. All rows of every table, paginated
    const tables: Record<string, unknown> = {};
    const errors: string[] = [];
    for (const t of tableNames) {
      const res = await dumpTable(admin, t);
      tables[t] = res;
      if (res.error) errors.push(`${t}: ${res.error}`);
    }

    // 3. User accounts (no password hashes available through the API)
    const authUsers: unknown[] = [];
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) { errors.push(`auth.users: ${error.message}`); break; }
      for (const u of data.users) {
        authUsers.push({
          id: u.id, email: u.email, phone: u.phone, created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at, email_confirmed_at: u.email_confirmed_at,
          app_metadata: u.app_metadata, user_metadata: u.user_metadata,
          identities: (u.identities ?? []).map((i) => ({ provider: i.provider, identity_data: i.identity_data })),
        });
      }
      if (data.users.length < 1000) break;
    }

    // 4. Storage: every file with a temporary download link
    const { data: buckets } = await admin.storage.listBuckets();
    const storage: Record<string, unknown> = {};
    let fileCount = 0;
    let totalBytes = 0;
    for (const b of buckets ?? []) {
      const files = await listBucket(admin, b.name);
      for (let i = 0; i < files.length; i += 100) {
        const chunk = files.slice(i, i + 100);
        const { data: signed } = await admin.storage.from(b.name)
          .createSignedUrls(chunk.map((f) => f.path), SIGNED_URL_SECONDS);
        chunk.forEach((f, idx) => { f.download_url = signed?.[idx]?.signedUrl ?? null; });
      }
      fileCount += files.length;
      totalBytes += files.reduce((s, f) => s + (f.size ?? 0), 0);
      storage[b.name] = { public: b.public, file_size_limit: b.file_size_limit, allowed_mime_types: b.allowed_mime_types, files };
    }

    // 5. Names (never values) of secrets that must be re-entered on a new host
    const secretNames = Object.keys(Deno.env.toObject()).filter((k) => !PLATFORM_ENV.test(k)).sort();

    const createdAt = new Date().toISOString();
    const backup = {
      _meta: {
        format: "shf-intra-backup/v2",
        created_at: createdAt,
        created_by: claims.user.email,
        table_count: tableNames.length,
        row_count: Object.values(tables).reduce((s: number, t: any) => s + t.count, 0),
        user_count: authUsers.length,
        file_count: fileCount,
        file_bytes: totalBytes,
        download_links_valid_until: new Date(Date.now() + SIGNED_URL_SECONDS * 1000).toISOString(),
        errors,
        notes: [
          "Kod och migrationer finns i GitHub-repot.",
          "Lösenord för användarkonton ingår inte; inloggning sker via Google och fungerar igen när Google-inloggning konfigureras.",
          "Hemliga nycklar (secrets) ingår endast som namn och måste läggas in på nytt.",
          "Filer ingår som nedladdningslänkar; ladda ner dem innan länkarna slutar gälla.",
        ],
      },
      schema,
      tables,
      auth_users: authUsers,
      storage,
      secrets_required: secretNames,
    };

    return new Response(JSON.stringify(backup), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup-${createdAt.slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    console.error("Backup error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
