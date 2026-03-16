import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Firecrawl-connector inte konfigurerad" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { url = "https://www.handelsfastigheter.se" } = await req.json().catch(() => ({}));

    console.log("Step 1: Mapping site URLs...");

    // Step 1: Map the site to discover URLs
    const mapResponse = await fetch("https://api.firecrawl.dev/v1/map", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        limit: 50,
        includeSubdomains: false,
      }),
    });

    const mapData = await mapResponse.json();
    if (!mapResponse.ok) {
      console.error("Map error:", mapData);
      return new Response(
        JSON.stringify({ error: mapData.error || "Kunde inte kartlägga webbplatsen" }),
        { status: mapResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const urls: string[] = mapData.links || [];
    console.log(`Found ${urls.length} URLs`);

    if (urls.length === 0) {
      return new Response(
        JSON.stringify({ success: true, indexed: 0, message: "Inga sidor hittades" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Scrape each page
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let indexed = 0;
    const errors: string[] = [];

    // Process in batches of 5
    for (let i = 0; i < urls.length; i += 5) {
      const batch = urls.slice(i, i + 5);

      const scrapePromises = batch.map(async (pageUrl) => {
        try {
          console.log(`Scraping: ${pageUrl}`);
          const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: pageUrl,
              formats: ["markdown"],
              onlyMainContent: true,
            }),
          });

          const scrapeData = await scrapeResp.json();
          if (!scrapeResp.ok) {
            errors.push(`${pageUrl}: ${scrapeData.error || scrapeResp.status}`);
            return;
          }

          const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
          const title =
            scrapeData.data?.metadata?.title ||
            scrapeData.metadata?.title ||
            pageUrl.split("/").pop() ||
            pageUrl;

          if (!markdown || markdown.trim().length < 20) {
            console.log(`Skipping ${pageUrl} — too little content`);
            return;
          }

          // Create a deterministic ID from the URL
          const sourceId = crypto.randomUUID();

          const { error: upsertError } = await supabase.from("content_index").upsert(
            {
              source_table: "website",
              source_id: sourceId,
              title: title.slice(0, 500),
              content: markdown.slice(0, 10000),
              metadata: { url: pageUrl, scraped_at: new Date().toISOString() },
              updated_at: new Date().toISOString(),
            },
            { onConflict: "source_table,source_id", ignoreDuplicates: false }
          );

          if (upsertError) {
            // Try insert instead (new page)
            const { error: insertError } = await supabase.from("content_index").insert({
              source_table: "website",
              source_id: sourceId,
              title: title.slice(0, 500),
              content: markdown.slice(0, 10000),
              metadata: { url: pageUrl, scraped_at: new Date().toISOString() },
              updated_at: new Date().toISOString(),
            });
            if (insertError) {
              errors.push(`${pageUrl}: DB error — ${insertError.message}`);
              return;
            }
          }

          indexed++;
          console.log(`Indexed: ${title}`);
        } catch (e) {
          errors.push(`${pageUrl}: ${e instanceof Error ? e.message : "Unknown error"}`);
        }
      });

      await Promise.all(scrapePromises);
    }

    console.log(`Done. Indexed: ${indexed}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        indexed,
        total_urls: urls.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Scrape error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Okänt fel" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
