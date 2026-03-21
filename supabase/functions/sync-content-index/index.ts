import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://intra.handelsfastigheter.se",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

/**
 * Upsert content into content_index with automatic chunking for long content.
 */
async function upsertChunked(
  supabase: any,
  sourceTable: string,
  sourceId: string,
  title: string,
  content: string,
  metadata: Record<string, any>,
): Promise<number> {
  let chunksCreated = 0;

  if (content.length <= CHUNK_SIZE) {
    await supabase.from("content_index").upsert(
      {
        source_table: sourceTable,
        source_id: sourceId,
        chunk_index: 0,
        title,
        content,
        metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_table,source_id,chunk_index" },
    );
    // Clean up old extra chunks
    await supabase
      .from("content_index")
      .delete()
      .eq("source_table", sourceTable)
      .eq("source_id", sourceId)
      .gt("chunk_index", 0);
    return 1;
  }

  // Split into overlapping chunks
  let start = 0;
  let chunkIdx = 0;
  while (start < content.length) {
    const chunk = content.slice(start, start + CHUNK_SIZE);
    const chunkTitle =
      chunkIdx > 0 ? `${title} (del ${chunkIdx + 1})` : title;

    await supabase.from("content_index").upsert(
      {
        source_table: sourceTable,
        source_id: sourceId,
        chunk_index: chunkIdx,
        title: chunkTitle,
        content: chunk,
        metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_table,source_id,chunk_index" },
    );

    chunksCreated++;
    chunkIdx++;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  // Clean up old chunks beyond current count
  await supabase
    .from("content_index")
    .delete()
    .eq("source_table", sourceTable)
    .eq("source_id", sourceId)
    .gte("chunk_index", chunkIdx);

  return chunksCreated;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let indexed = 0;

    // Index all published kb_articles
    const { data: articles } = await supabase
      .from("kb_articles")
      .select("id, title, excerpt, content, tags, category_id")
      .eq("is_published", true);

    if (articles) {
      for (const a of articles) {
        indexed += await upsertChunked(
          supabase, "kb_articles", a.id, a.title,
          `${a.excerpt}\n${a.content}`,
          { tags: a.tags, category_id: a.category_id },
        );
      }
    }

    // Index all active FAQ
    const { data: faqs } = await supabase
      .from("it_faq")
      .select("id, question, answer")
      .eq("is_active", true);

    if (faqs) {
      for (const f of faqs) {
        indexed += await upsertChunked(
          supabase, "it_faq", f.id, f.question, f.answer, {},
        );
      }
    }

    // Index all published videos
    const { data: videos } = await supabase
      .from("kb_videos")
      .select("id, title, description, tags, video_url")
      .eq("is_published", true);

    if (videos) {
      for (const v of videos) {
        indexed += await upsertChunked(
          supabase, "kb_videos", v.id, v.title, v.description,
          { tags: v.tags, video_url: v.video_url },
        );
      }
    }

    // Index all published news
    const { data: newsItems } = await supabase
      .from("news")
      .select("id, title, excerpt, body, category, emoji, published_at")
      .eq("is_published", true);

    if (newsItems) {
      for (const n of newsItems) {
        indexed += await upsertChunked(
          supabase, "news", n.id, n.title,
          `${n.excerpt}\n${n.body}`,
          { category: n.category, emoji: n.emoji, published_at: n.published_at },
        );
      }
    }

    // Index CEO blog posts
    const { data: blogPosts } = await supabase
      .from("ceo_blog")
      .select("id, title, excerpt, author, period");

    if (blogPosts) {
      for (const b of blogPosts) {
        indexed += await upsertChunked(
          supabase, "ceo_blog", b.id, b.title, b.excerpt,
          { author: b.author, period: b.period },
        );
      }
    }

    // Index active tools
    const { data: tools } = await supabase
      .from("tools")
      .select("id, name, description, url, emoji")
      .eq("is_active", true);

    if (tools) {
      for (const t of tools) {
        indexed += await upsertChunked(
          supabase, "tools", t.id, t.name, t.description,
          { url: t.url, emoji: t.emoji },
        );
      }
    }

    // Index departments
    const { data: departments } = await supabase
      .from("departments")
      .select("id, name, color, parent_id");

    if (departments) {
      for (const d of departments) {
        const parentName = d.parent_id
          ? departments.find((p: any) => p.id === d.parent_id)?.name
          : null;
        const content = parentName
          ? `Avdelning: ${d.name}, tillhör ${parentName}`
          : `Avdelning: ${d.name}`;
        indexed += await upsertChunked(
          supabase, "departments", d.id, d.name, content,
          { color: d.color, parent_id: d.parent_id },
        );
      }
    }

    // Index document folders
    const { data: folders } = await supabase
      .from("document_folders")
      .select("id, name, icon, parent_id");

    if (folders) {
      for (const f of folders) {
        const parentName = f.parent_id
          ? folders.find((p: any) => p.id === f.parent_id)?.name
          : null;
        const content = parentName
          ? `Dokumentmapp: ${f.name} i mappen ${parentName}`
          : `Dokumentmapp: ${f.name}`;
        indexed += await upsertChunked(
          supabase, "document_folders", f.id, f.name, content,
          { icon: f.icon, parent_id: f.parent_id },
        );
      }
    }

    // Index document file metadata
    const { data: files } = await supabase
      .from("document_files")
      .select("id, name, mime_type, folder_id");

    if (files && folders) {
      for (const file of files) {
        const folderName =
          folders.find((f: any) => f.id === file.folder_id)?.name || "okänd mapp";
        indexed += await upsertChunked(
          supabase, "document_files", file.id, file.name,
          `Dokument "${file.name}" i mappen "${folderName}" (typ: ${file.mime_type})`,
          { folder_id: file.folder_id, mime_type: file.mime_type },
        );
      }
    }

    console.log(`Indexed ${indexed} items (including chunks)`);
    return new Response(
      JSON.stringify({ success: true, indexed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Sync error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
