import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
}

// Google Drive MIME types we can extract text from
const EXTRACTABLE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "text",
  "text/csv": "text",
  "application/json": "text",
  // Google Docs native formats – export as text
  "application/vnd.google-apps.document": "gdoc",
  "application/vnd.google-apps.spreadsheet": "gsheet",
};

const DRIVE_FOLDER_IDS = [
  "13LUIOErVpjQXyLiP-UfLIB1rX6yNjnZg",
  "1f6lnFyvIMDOQ_tKqfpZrWmNQqEBGnnH8",
  "1HW9VFaXj62kCU0BZBAInL4f-S2R0aiPE",
];

/* ── Google Auth (Service Account JWT) ─────────────── */

async function getAccessToken(serviceAccountKey: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountKey.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const pemContents = serviceAccountKey.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const jwt = `${unsignedToken}.${base64url(new Uint8Array(signature))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Token exchange failed: ${tokenRes.status} ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

function base64url(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ── Drive API helpers ─────────────────────────────── */

async function listFilesInFolder(
  accessToken: string,
  folderId: string,
  pageToken?: string
): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,modifiedTime,size)");
  let url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=100`;
  if (pageToken) url += `&pageToken=${pageToken}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive list failed: ${res.status} ${errText}`);
  }
  return res.json();
}

async function listAllFiles(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const result = await listFilesInFolder(accessToken, folderId, pageToken);
    allFiles.push(...result.files);
    pageToken = result.nextPageToken;
  } while (pageToken);

  // Recurse into subfolders
  const subFolders = allFiles.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
  for (const folder of subFolders) {
    const subFiles = await listAllFiles(accessToken, folder.id);
    allFiles.push(...subFiles);
  }

  return allFiles.filter((f) => f.mimeType !== "application/vnd.google-apps.folder");
}

async function downloadFile(accessToken: string, file: DriveFile): Promise<Blob | null> {
  const fileType = EXTRACTABLE_TYPES[file.mimeType];
  if (!fileType) return null;

  let url: string;
  if (fileType === "gdoc") {
    url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`;
  } else if (fileType === "gsheet") {
    url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/csv`;
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    console.error(`Download failed for "${file.name}": ${res.status}`);
    return null;
  }

  return res.blob();
}

/* ── Text extractors ───────────────────────────────── */

async function extractText(blob: Blob, mimeType: string): Promise<string> {
  const fileType = EXTRACTABLE_TYPES[mimeType];

  if (fileType === "text" || fileType === "gdoc" || fileType === "gsheet") {
    return blob.text();
  }

  if (fileType === "pdf") {
    const { default: pdfParse } = await import("npm:pdf-parse@1.1.1");
    const buffer = new Uint8Array(await blob.arrayBuffer());
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (fileType === "docx") {
    const mammoth = await import("npm:mammoth@1.8.0");
    const buffer = new Uint8Array(await blob.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (fileType === "xlsx") {
    const XLSX = await import("npm:xlsx@0.18.5");
    const arrayBuffer = await blob.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
    const texts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      texts.push(`--- ${sheetName} ---\n${csv}`);
    }
    return texts.join("\n\n");
  }

  return "";
}

/* ── Integration status helper ─────────────────────── */

async function updateIntegrationStatus(
  sb: ReturnType<typeof createClient>,
  status: "ok" | "warning" | "error",
  metadata?: Record<string, unknown>,
  lastError?: string
) {
  const update: Record<string, unknown> = {
    status,
    last_sync_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (status === "ok") {
    update.last_error = null;
    update.error_count = 0;
  } else {
    update.last_error = lastError;
  }
  if (metadata) update.metadata = metadata;
  await sb.from("integration_status").update(update).eq("slug", "google-drive");
}

/* ── Main handler ──────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Verify caller is admin or IT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin or IT role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const { data: groupRoles } = await supabase
      .from("group_members")
      .select("group_id, groups!inner(role_equivalent)")
      .eq("user_id", user.id);
    const allRoles = [
      ...(roles?.map((r: any) => r.role) || []),
      ...(groupRoles?.map((g: any) => (g as any).groups?.role_equivalent).filter(Boolean) || []),
    ];
    if (!allRoles.includes("admin") && !allRoles.includes("it")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse service account key
    const saKeyRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!saKeyRaw) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");
    }
    const saKey = JSON.parse(saKeyRaw);

    // Get access token
    console.log("🔑 Authenticating with Google...");
    const accessToken = await getAccessToken(saKey);

    // List all files from configured folders
    let totalFiles = 0;
    let indexedFiles = 0;
    let skippedFiles = 0;
    let errorFiles = 0;
    const errors: string[] = [];

    for (const folderId of DRIVE_FOLDER_IDS) {
      console.log(`📁 Scanning folder ${folderId}...`);
      let files: DriveFile[];
      try {
        files = await listAllFiles(accessToken, folderId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error(`Failed to list folder ${folderId}: ${msg}`);
        errors.push(`Folder ${folderId}: ${msg}`);
        continue;
      }

      console.log(`  Found ${files.length} files`);
      totalFiles += files.length;

      for (const file of files) {
        if (!EXTRACTABLE_TYPES[file.mimeType]) {
          skippedFiles++;
          continue;
        }

        try {
          const blob = await downloadFile(accessToken, file);
          if (!blob) {
            skippedFiles++;
            continue;
          }

          const text = await extractText(blob, file.mimeType);
          if (!text?.trim()) {
            console.log(`  ⚠ No text from "${file.name}"`);
            skippedFiles++;
            continue;
          }

          // Truncate and index using chunking function
          const content = text.substring(0, 50_000);
          const indexContent = `Google Drive-dokument "${file.name}":\n\n${content}`;

          const { error: rpcErr } = await supabase.rpc("upsert_chunked_content", {
            _source_table: "google_drive",
            _source_id: file.id,
            _title: file.name,
            _content: indexContent,
            _metadata: {
              drive_folder_id: folderId,
              mime_type: file.mimeType,
              modified_time: file.modifiedTime,
              extracted: true,
              chars: content.length,
            },
            _chunk_size: 800,
          });

          if (rpcErr) {
            console.error(`  ✗ Index error for "${file.name}": ${rpcErr.message}`);
            errorFiles++;
            errors.push(`${file.name}: ${rpcErr.message}`);
          } else {
            console.log(`  ✓ Indexed "${file.name}" (${content.length} chars)`);
            indexedFiles++;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown";
          console.error(`  ✗ Error processing "${file.name}": ${msg}`);
          errorFiles++;
          errors.push(`${file.name}: ${msg}`);
        }
      }
    }

    const resultMeta = {
      total_files: totalFiles,
      indexed: indexedFiles,
      skipped: skippedFiles,
      errors: errorFiles,
      last_errors: errors.slice(0, 5),
      folders: DRIVE_FOLDER_IDS.length,
    };

    const finalStatus = errorFiles > 0 && indexedFiles === 0 ? "error" : errorFiles > 0 ? "warning" : "ok";
    await updateIntegrationStatus(supabase, finalStatus, resultMeta, errors[0]);

    console.log(`\n✅ Done: ${indexedFiles} indexed, ${skippedFiles} skipped, ${errorFiles} errors`);

    return new Response(JSON.stringify({ success: true, ...resultMeta }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("index-google-drive error:", msg);
    await updateIntegrationStatus(supabase, "error", undefined, msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
