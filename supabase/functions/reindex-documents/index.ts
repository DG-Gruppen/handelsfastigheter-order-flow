import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const EXTRACTABLE_MIMES = [
      "text/",
      "application/pdf",
      "application/json",
      "application/xml",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    // Fetch all document files
    const { data: files, error: filesErr } = await supabase
      .from("document_files")
      .select("id, storage_path, mime_type, name, folder_id");

    if (filesErr) {
      console.error("Failed to fetch files:", filesErr.message);
      return new Response(
        JSON.stringify({ error: filesErr.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Filter to extractable types
    const extractable = (files || []).filter((f) =>
      EXTRACTABLE_MIMES.some((m) =>
        m.endsWith("/") ? f.mime_type.startsWith(m) : f.mime_type === m
      )
    );

    // Check which ones already have extracted content
    const { data: indexed } = await supabase
      .from("content_index")
      .select("source_id, metadata")
      .eq("source_table", "document_files")
      .in("source_id", extractable.map((f) => f.id));

    const alreadyExtracted = new Set(
      (indexed || [])
        .filter((i) => i.metadata && (i.metadata as any).extracted === true)
        .map((i) => i.source_id)
    );

    const toProcess = extractable.filter((f) => !alreadyExtracted.has(f.id));

    console.log(
      `Found ${extractable.length} extractable files, ${alreadyExtracted.size} already done, ${toProcess.length} to process`
    );

    let processed = 0;
    let failed = 0;

    // Process sequentially to avoid overwhelming storage/memory
    for (const file of toProcess) {
      try {
        // Call the extract-document-text function for each file
        const extractUrl =
          Deno.env.get("SUPABASE_URL") +
          "/functions/v1/extract-document-text";

        const res = await fetch(extractUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            record: {
              id: file.id,
              storage_path: file.storage_path,
              mime_type: file.mime_type,
              name: file.name,
              folder_id: file.folder_id,
            },
          }),
        });

        const result = await res.json();
        if (result.success) {
          processed++;
          console.log(`✓ ${file.name} (${result.chars} chars)`);
        } else {
          console.log(`⊘ ${file.name}: ${result.reason || "skipped"}`);
        }
      } catch (err) {
        failed++;
        console.error(`✗ ${file.name}:`, err);
      }

      // Small delay between files to be gentle on resources
      await new Promise((r) => setTimeout(r, 500));
    }

    const summary = {
      success: true,
      total_extractable: extractable.length,
      already_extracted: alreadyExtracted.size,
      processed,
      failed,
    };

    console.log("Reindex complete:", summary);
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reindex-documents error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
