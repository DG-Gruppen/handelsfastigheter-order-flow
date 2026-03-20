import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  // Cision XML uses <Release> elements
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
  // Fallback: try <item> tags (some Cision XML feeds use RSS-like structure)
  if (items.length === 0) {
    return parseRss(xml);
  }
  return items;
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

    return new Response(
      JSON.stringify({ releases, source: releases.length > 0 ? "cision" : "empty" }),
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
