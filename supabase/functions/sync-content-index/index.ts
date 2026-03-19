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
