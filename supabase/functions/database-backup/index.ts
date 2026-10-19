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
const DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const DRIVE_FOLDER_NAME = "SHF Intra Backups";

function driveHeaders() {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const connKey = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!lovableKey || !connKey) throw new Error("Google Drive-anslutning saknas (GOOGLE_DRIVE_API_KEY)");
  return { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connKey };
}

async function driveApi(path: string, init: RequestInit = {}) {
  const res = await fetch(`${DRIVE_GATEWAY}${path}`, {
    ...init,
    headers: { ...driveHeaders(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Drive ${res.status}: ${body}`);
  }
  return res.json();
}

async function ensureDriveFolder(): Promise<string> {
  const q = encodeURIComponent(
    `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const found = await driveApi(`/drive/v3/files?q=${q}&fields=files(id,name)`);
  if (found.files?.length) return found.files[0].id;
  const created = await driveApi("/drive/v3/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  return created.id;
}

async function uploadBackupToDrive(filename: string, bytes: Uint8Array): Promise<{ id: string; name: string }> {
  const folderId = await ensureDriveFolder();
  // 1. Create the file metadata, 2. upload content as raw media (avoids multipart copies in memory)
  const created = await driveApi("/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: filename, parents: [folderId] }),
  });
  const res = await fetch(
    `${DRIVE_GATEWAY}/upload/drive/v3/files/${created.id}?uploadType=media&fields=id,name,webViewLink`,
    { method: "PATCH", headers: { ...driveHeaders(), "Content-Type": "application/json" }, body: bytes }
  );
  if (!res.ok) throw new Error(`Google Drive ${res.status}: ${await res.text()}`);
  return res.json();
}
// Platform-managed env vars that are recreated automatically on any Supabase host.
const PLATFORM_ENV = /^(SUPABASE_|DENO_|SB_|PATH$|HOME$|HOSTNAME$|PWD$|LANG$|TZ$|EDGE_|AWS_|LOVABLE_API_KEY$)/;

// Streams each row to JSON text immediately, so the full table never
// exists as a JS object graph in memory (keeps peak memory low).
async function dumpTableJson(client: SupabaseClient, table: string): Promise<{ json: string; count: number; error: string | null }> {
  const rowParts: string[] = [];
  let count = 0;
  let error: string | null = null;
  for (let from = 0; ; from += PAGE) {
    const { data, error: err } = await client.from(table).select("*").range(from, from + PAGE - 1);
    if (err) { error = err.message; break; }
    for (const row of data ?? []) rowParts.push(JSON.stringify(row));
    count += data?.length ?? 0;
    if (!data || data.length < PAGE) break;
  }
  const json = `{"count":${count},"rows":[${rowParts.join(",")}],"error":${error ? JSON.stringify(error) : "null"}}`;
  return { json, count, error };
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
    console.log(`[backup] schema ok, ${tableNames.length} tables`);

    // 2. All rows of every table, paginated — streamed to JSON strings per table
    //    to keep peak memory low (no full object graph + full string at once).
    const tableChunks: string[] = [];
    const errors: string[] = [];
    let rowCount = 0;
    for (const t of tableNames) {
      const res = await dumpTableJson(admin, t);
      rowCount += res.count;
      if (res.error) errors.push(`${t}: ${res.error}`);
      tableChunks.push(`${JSON.stringify(t)}:${res.json}`);
      console.log(`[backup] table ${t}: ${res.count} rows, ${res.json.length} chars`);
    }
    console.log(`[backup] tables done, ${rowCount} rows`);

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
    const meta = {
      format: "shf-intra-backup/v2",
      created_at: createdAt,
      created_by: claims.user.email,
      table_count: tableNames.length,
      row_count: rowCount,
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
    };

    // Optional: upload to Google Drive instead of returning the file
    let uploadToDrive = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        uploadToDrive = body?.upload_to_drive === true;
      } catch { /* empty body */ }
    }

    // Assemble the final JSON from pre-stringified chunks (key order is irrelevant).
    console.log("[backup] assembling final JSON");
    const backupJson =
      `{"_meta":${JSON.stringify(meta)},"schema":${JSON.stringify(schema)},"tables":{` +
      tableChunks.join(",") +
      `},"auth_users":${JSON.stringify(authUsers)},"storage":${JSON.stringify(storage)},"secrets_required":${JSON.stringify(secretNames)}}`;
    tableChunks.length = 0;
    console.log(`[backup] final JSON ${backupJson.length} chars`);
    const filename = `shf-backup-${createdAt.slice(0, 10)}.json`;

    if (uploadToDrive) {
      const bytes = new TextEncoder().encode(backupJson);
      const file = await uploadBackupToDrive(filename, bytes);
      return json({
        success: true,
        drive_file: file,
        folder: DRIVE_FOLDER_NAME,
        meta,
      });
    }

    return new Response(backupJson, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Backup error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
