import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Cision newsroom feed URL for Svenska Handelsfastigheter
const CISION_FEED_URL =
  "https://publish.ne.cision.com/papi/NewsFeed/GetLatestReleases?pageSize=20&pageIndex=1&format=json&organizationName=svenska-handelsfastigheter";

// Fallback: try RSS
const CISION_RSS_URL = "https://news.cision.com/se/svenska-handelsfastigheter/rss";

interface CisionRelease {
  Id: string;
  Title: string;
  PublishDate: string;
  Header?: string;
  Body?: string;
  Intro?: string;
  Url?: string;
  Images?: Array<{ DownloadUrl?: string; FileName?: string }>;
  Categories?: string[];
}

function parseRssItem(xml: string): Array<{
  id: string;
  title: string;
  excerpt: string;
  url: string;
  published_at: string;
  image_url?: string;
}> {
  const items: Array<{
    id: string;
    title: string;
    excerpt: string;
    url: string;
    published_at: string;
    image_url?: string;
  }> = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const getTag = (tag: string) => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return (m?.[1] || m?.[2] || "").trim();
    };
    const guid = getTag("guid") || getTag("link") || crypto.randomUUID();
    const title = getTag("title");
    const description = getTag("description").replace(/<[^>]*>/g, "").slice(0, 300);
    const link = getTag("link");
    const pubDate = getTag("pubDate");

    if (title) {
      items.push({
        id: guid,
        title,
        excerpt: description,
        url: link,
        published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      });
    }
  }
  return items;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Try JSON feed first
    let releases: Array<{
      id: string;
      title: string;
      excerpt: string;
      url: string;
      published_at: string;
      image_url?: string;
    }> = [];

    try {
      console.log("Trying Cision JSON feed...");
      const jsonResp = await fetch(CISION_FEED_URL, {
        headers: { Accept: "application/json" },
      });
      if (jsonResp.ok) {
        const data = await jsonResp.json();
        const rawReleases: CisionRelease[] = data.Releases || data.releases || data || [];
        if (Array.isArray(rawReleases) && rawReleases.length > 0) {
          releases = rawReleases.map((r) => ({
            id: r.Id || crypto.randomUUID(),
            title: r.Title || "",
            excerpt: (r.Intro || r.Header || "").replace(/<[^>]*>/g, "").slice(0, 300),
            url: r.Url || "",
            published_at: r.PublishDate || new Date().toISOString(),
            image_url: r.Images?.[0]?.DownloadUrl,
          }));
          console.log(`Got ${releases.length} releases from JSON feed`);
        }
      }
    } catch (e) {
      console.log("JSON feed failed, trying RSS...", e);
    }

    // Fallback to RSS
    if (releases.length === 0) {
      console.log("Trying Cision RSS feed...");
      const rssResp = await fetch(CISION_RSS_URL);
      if (rssResp.ok) {
        const xml = await rssResp.text();
        releases = parseRssItem(xml);
        console.log(`Got ${releases.length} releases from RSS feed`);
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
