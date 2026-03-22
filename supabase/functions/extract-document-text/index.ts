import { createClient } from "npm:@supabase/supabase-js@2";

async function updateIntegrationStatus(status: "ok" | "warning" | "error", lastError?: string) {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const update: Record<string, unknown> = {
      status,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (status === "ok") { update.last_error = null; update.error_count = 0; }
    else {
      update.last_error = lastError;
      const { data } = await sb.from("integration_status").select("error_count").eq("slug", "document-extract").single();
      update.error_count = ((data?.error_count) || 0) + 1;
    }
    await sb.from("integration_status").update(update).eq("slug", "document-extract");
  } catch (e) { console.error("Failed to update integration status:", e); }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { record } = await req.json();
    if (!record?.id || !record?.storage_path || !record?.mime_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { id, storage_path, mime_type, name, folder_id } = record;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Download file from Storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("documents")
      .download(storage_path);

    if (dlErr || !fileData) {
      console.error("Download failed:", dlErr?.message);
      return new Response(
        JSON.stringify({ error: "Download failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    let extractedText = "";

    try {
      if (
        mime_type.startsWith("text/") ||
        mime_type === "application/json" ||
        mime_type === "application/xml"
      ) {
        extractedText = await fileData.text();
      } else if (mime_type === "application/pdf") {
        extractedText = await extractPdfText(fileData);
      } else if (
        mime_type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        extractedText = await extractDocxText(fileData);
      } else if (
        mime_type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ) {
        extractedText = await extractXlsxText(fileData);
      } else {
        console.log(`Unsupported mime type: ${mime_type}`);
        return new Response(
          JSON.stringify({ skipped: true, reason: "unsupported mime type" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch (extractErr) {
      console.error(
        `Extraction failed for "${name}" (${mime_type}):`,
        extractErr
      );
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: `extraction error: ${extractErr instanceof Error ? extractErr.message : "unknown"}`,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!extractedText?.trim()) {
      console.log(`No text extracted from "${name}"`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "no text extracted" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Truncate to 50 000 chars to keep content_index manageable
    const content = extractedText.substring(0, 50_000);

    // Get folder name for context
    let folderName = "";
    if (folder_id) {
      const { data: folder } = await supabase
        .from("document_folders")
        .select("name")
        .eq("id", folder_id)
        .single();
      folderName = folder?.name || "";
    }

    const indexContent = folderName
      ? `Dokument "${name}" i mappen "${folderName}":

${content}`
      : `Dokument "${name}":

${content}`;

    const { error: upsertErr } = await supabase.from("content_index").upsert(
      {
        source_table: "document_files",
        source_id: id,
        title: name,
        content: indexContent,
        metadata: {
          folder_id,
          mime_type,
          extracted: true,
          chars: content.length,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_table,source_id" }
    );

    if (upsertErr) {
      console.error("Upsert error:", upsertErr.message);
      return new Response(
        JSON.stringify({ error: "Index update failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`✓ Extracted ${content.length} chars from "${name}"`);
    await updateIntegrationStatus("ok");
    return new Response(
      JSON.stringify({ success: true, chars: content.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-document-text error:", e);
    await updateIntegrationStatus("error", e instanceof Error ? e.message : "Unknown error");
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/* ── Extractors ─────────────────────────────────────── */

async function extractPdfText(blob: Blob): Promise<string> {
  const { default: pdfParse } = await import("npm:pdf-parse@1.1.1");
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const result = await pdfParse(buffer);
  return result.text;
}

async function extractDocxText(blob: Blob): Promise<string> {
  const mammoth = await import("npm:mammoth@1.8.0");
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  // mammoth accepts { buffer } (Node Buffer-like) in Deno
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractXlsxText(blob: Blob): Promise<string> {
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
