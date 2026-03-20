import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://intra.handelsfastigheter.se",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let indexed = 0;

    // Index all published kb_articles
    const { data: articles } = await supabase
      .from("kb_articles")
      .select("id, title, excerpt, content, tags, category_id")
      .eq("is_published", true);

    if (articles) {
      for (const a of articles) {
        await supabase.from("content_index").upsert(
          {
            source_table: "kb_articles",
            source_id: a.id,
            title: a.title,
            content: `${a.excerpt}\n${a.content}`,
            metadata: { tags: a.tags, category_id: a.category_id },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source_table,source_id" }
        );
        indexed++;
      }
    }

    // Index all active FAQ
    const { data: faqs } = await supabase
      .from("it_faq")
      .select("id, question, answer")
      .eq("is_active", true);

    if (faqs) {
      for (const f of faqs) {
        await supabase.from("content_index").upsert(
          {
            source_table: "it_faq",
            source_id: f.id,
            title: f.question,
            content: f.answer,
            metadata: {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source_table,source_id" }
        );
        indexed++;
      }
    }

    // Index all published videos
    const { data: videos } = await supabase
      .from("kb_videos")
      .select("id, title, description, tags, video_url")
      .eq("is_published", true);

    if (videos) {
      for (const v of videos) {
        await supabase.from("content_index").upsert(
          {
            source_table: "kb_videos",
            source_id: v.id,
            title: v.title,
            content: v.description,
            metadata: { tags: v.tags, video_url: v.video_url },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source_table,source_id" }
        );
        indexed++;
      }
    }

    // Index all published news
    const { data: newsItems } = await supabase
      .from("news")
      .select("id, title, excerpt, body, category, emoji, published_at")
      .eq("is_published", true);

    if (newsItems) {
      for (const n of newsItems) {
        await supabase.from("content_index").upsert(
          {
            source_table: "news",
            source_id: n.id,
            title: n.title,
            content: `${n.excerpt}\n${n.body}`,
            metadata: { category: n.category, emoji: n.emoji, published_at: n.published_at },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source_table,source_id" }
        );
        indexed++;
      }
    }

    // Index CEO blog posts
    const { data: blogPosts } = await supabase
      .from("ceo_blog")
      .select("id, title, excerpt, author, period");

    if (blogPosts) {
      for (const b of blogPosts) {
        await supabase.from("content_index").upsert(
          {
            source_table: "ceo_blog",
            source_id: b.id,
            title: b.title,
            content: b.excerpt,
            metadata: { author: b.author, period: b.period },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source_table,source_id" }
        );
        indexed++;
      }
    }

    // Index active tools
    const { data: tools } = await supabase
      .from("tools")
      .select("id, name, description, url, emoji")
      .eq("is_active", true);

    if (tools) {
      for (const t of tools) {
        await supabase.from("content_index").upsert(
          {
            source_table: "tools",
            source_id: t.id,
            title: t.name,
            content: t.description,
            metadata: { url: t.url, emoji: t.emoji },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source_table,source_id" }
        );
        indexed++;
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
        await supabase.from("content_index").upsert(
          {
            source_table: "departments",
            source_id: d.id,
            title: d.name,
            content,
            metadata: { color: d.color, parent_id: d.parent_id },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source_table,source_id" }
        );
        indexed++;
      }
    }

    // Index document folders (metadata only — file contents are binary)
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
        await supabase.from("content_index").upsert(
          {
            source_table: "document_folders",
            source_id: f.id,
            title: f.name,
            content,
            metadata: { icon: f.icon, parent_id: f.parent_id },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source_table,source_id" }
        );
        indexed++;
      }
    }

    // Index document file metadata
    const { data: files } = await supabase
      .from("document_files")
      .select("id, name, mime_type, folder_id");

    if (files && folders) {
      for (const file of files) {
        const folderName = folders.find((f: any) => f.id === file.folder_id)?.name || "okänd mapp";
        await supabase.from("content_index").upsert(
          {
            source_table: "document_files",
            source_id: file.id,
            title: file.name,
            content: `Dokument "${file.name}" i mappen "${folderName}" (typ: ${file.mime_type})`,
            metadata: { folder_id: file.folder_id, mime_type: file.mime_type },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source_table,source_id" }
        );
        indexed++;
      }
    }

    console.log(`Indexed ${indexed} items`);
    return new Response(
      JSON.stringify({ success: true, indexed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Sync error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
