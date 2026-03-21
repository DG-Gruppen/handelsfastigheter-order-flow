import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Primary: RSS feed
const CISION_RSS_URL =
  "https://news.cision.com/se/svenska-handelsfastigheter/ListItems?format=rss";

// Fallback: XML feed
const CISION_XML_URL =
  "https://publish.ne.cision.com/Release/ListReleasesSortedByPublishDate/?feedUniqueIdentifier=2108847f44";

interface Release {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  published_at: string;
  image_url?: string;
}

function getTag(xml: string, tag: string): string {
  const m = xml.match(
    new RegExp(
      `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`
    )
  );
  return (m?.[1] || m?.[2] || "").trim();
}

function parseRss(xml: string): Release[] {
  const items: Release[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = getTag(block, "title");
    if (!title) continue;
    const guid = getTag(block, "guid") || getTag(block, "link") || crypto.randomUUID();
    const description = getTag(block, "description").replace(/<[^>]*>/g, "").slice(0, 300);
    const link = getTag(block, "link");
    const pubDate = getTag(block, "pubDate");
    const encUrl = block.match(/<enclosure[^>]+url="([^"]+)"/)?.[1];
    items.push({
      id: guid,
      title,
      excerpt: description,
      url: link,
      published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      image_url: encUrl,
    });
  }
  return items;
}

function parseXmlFeed(xml: string): Release[] {
  const items: Release[] = [];
  const releaseRegex = /<Release>([\s\S]*?)<\/Release>/gi;
  let match;
  while ((match = releaseRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = getTag(block, "Title");
    if (!title) continue;
    const id = getTag(block, "Id") || getTag(block, "ReleaseId") || crypto.randomUUID();
    const intro = getTag(block, "Intro") || getTag(block, "Header") || "";
    const url = getTag(block, "Url") || getTag(block, "DetailUrl") || "";
    const pubDate = getTag(block, "PublishDate") || getTag(block, "Published") || "";
    const imgMatch = block.match(/<DownloadUrl[^>]*>([^<]+)<\/DownloadUrl>/i);
    items.push({
      id,
      title,
      excerpt: intro.replace(/<[^>]*>/g, "").slice(0, 300),
      url,
      published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      image_url: imgMatch?.[1]?.trim(),
    });
  }
  if (items.length === 0) {
    return parseRss(xml);
  }
  return items;
}

async function syncToNewsTable(releases: Release[]) {
  if (releases.length === 0) return { imported: 0 };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Get existing Cision source_urls to avoid duplicates
  const { data: existing } = await supabase
    .from("news")
    .select("source_url")
    .eq("source", "cision")
    .not("source_url", "is", null);

  const existingUrls = new Set((existing ?? []).map((r: any) => r.source_url));

  // Find an admin user to use as author
  // Check both user_roles table AND groups with role_equivalent = 'admin'
  let authorUserId: string | null = null;

  // 1) Try user_roles first
  const { data: directAdmin } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .single();

  if (directAdmin) {
    authorUserId = directAdmin.user_id;
  } else {
    // 2) Fall back to groups with role_equivalent = 'admin'
    const { data: adminGroups } = await supabase
      .from("groups")
      .select("id")
      .eq("role_equivalent", "admin");

    if (adminGroups && adminGroups.length > 0) {
      const groupIds = adminGroups.map((g: any) => g.id);
      const { data: groupMember } = await supabase
        .from("group_members")
        .select("user_id")
        .in("group_id", groupIds)
        .limit(1)
        .single();

      if (groupMember) {
        authorUserId = groupMember.user_id;
      }
    }
  }

  if (!authorUserId) {
    console.error("No admin user found for Cision import author");
    return { imported: 0, error: "No admin user" };
  }

  console.log("Using author_id:", authorUserId);

  const authorId = adminRole.user_id;

  // Filter to only new releases
  const newReleases = releases.filter((r) => r.url && !existingUrls.has(r.url));
  if (newReleases.length === 0) {
    console.log("No new Cision releases to import");
    return { imported: 0 };
  }

  const rows = newReleases.map((r) => ({
    title: r.title,
    excerpt: r.excerpt,
    body: `<p>${r.excerpt}</p>${r.url ? `<p><a href="${r.url}" target="_blank" rel="noopener noreferrer">Läs hela pressmeddelandet på Cision →</a></p>` : ""}`,
    category: "Pressmeddelande",
    emoji: "📢",
    is_published: true,
    is_pinned: false,
    author_id: authorId,
    published_at: r.published_at,
    source: "cision",
    source_url: r.url,
  }));

  const { error } = await supabase.from("news").insert(rows);
  if (error) {
    console.error("Error inserting Cision news:", error);
    return { imported: 0, error: error.message };
  }

  console.log(`Imported ${rows.length} new Cision releases to news table`);
  return { imported: rows.length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let releases: Release[] = [];

    // Primary: RSS
    try {
      console.log("Trying Cision RSS feed (primary)...");
      const resp = await fetch(CISION_RSS_URL);
      if (resp.ok) {
        const xml = await resp.text();
        releases = parseRss(xml);
        console.log(`Got ${releases.length} releases from RSS feed`);
      }
    } catch (e) {
      console.log("RSS feed failed, trying XML fallback...", e);
    }

    // Fallback: XML
    if (releases.length === 0) {
      try {
        console.log("Trying Cision XML feed (fallback)...");
        const resp = await fetch(CISION_XML_URL);
        if (resp.ok) {
          const xml = await resp.text();
          releases = parseXmlFeed(xml);
          console.log(`Got ${releases.length} releases from XML feed`);
        }
      } catch (e) {
        console.log("XML feed also failed", e);
      }
    }

    // Sync to news table (auto-import)
    const syncResult = await syncToNewsTable(releases);

    return new Response(
      JSON.stringify({
        releases,
        source: releases.length > 0 ? "cision" : "empty",
        sync: syncResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Cision feed error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Okänt fel", releases: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
