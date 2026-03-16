import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Known SHF company URLs on allabolag.se
const COMPANY_URLS = [
  // Moderbolag
  "https://www.allabolag.se/foretag/lsth-svenska-handelsfastigheter-ab/-/-/5590092325",
  // Koncernbolag - these are the key ones we can find publicly
  "https://www.allabolag.se/foretag/svenska-handelsfastigheter-ab/-/-/5565679531",
  "https://www.allabolag.se/foretag/shf-mariestad-ab/-/-/5592397852",
  "https://www.allabolag.se/foretag/shf-borlange-ab/-/-/5592397860",
  "https://www.allabolag.se/foretag/shf-lidkoping-ab/-/-/5592397878",
  "https://www.allabolag.se/foretag/shf-varnamo-ab/-/-/5592397886",
  "https://www.allabolag.se/foretag/shf-helsingborg-ab/-/-/5592397894",
  "https://www.allabolag.se/foretag/shf-karlstad-ab/-/-/5592693655",
  "https://www.allabolag.se/foretag/shf-norrtalje-ab/-/-/5592693663",
  "https://www.allabolag.se/foretag/shf-sollentuna-ab/-/-/5592693671",
  "https://www.allabolag.se/foretag/shf-falkoping-ab/-/-/5592693689",
  "https://www.allabolag.se/foretag/shf-nassjo-ab/-/-/5592693697",
];

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

    const body = await req.json().catch(() => ({}));
    const { additional_urls = [] } = body;

    // Combine known URLs with any additional ones
    const allUrls = [...COMPANY_URLS, ...additional_urls];

    // Also try to discover more SHF companies via Firecrawl map
    console.log("Step 1: Mapping allabolag.se for SHF companies...");
    try {
      const mapResponse = await fetch("https://api.firecrawl.dev/v1/map", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://www.allabolag.se/foretag/lsth-svenska-handelsfastigheter-ab/-/-/5590092325",
          search: "svenska handelsfastigheter shf",
          limit: 100,
          includeSubdomains: false,
        }),
      });

      const mapData = await mapResponse.json();
      if (mapResponse.ok && mapData.links) {
        const shfLinks = (mapData.links as string[]).filter(
          (url: string) =>
            url.includes("allabolag.se/foretag/") &&
            (url.toLowerCase().includes("handelsfastigheter") ||
              url.toLowerCase().includes("shf-"))
        );
        console.log(`Found ${shfLinks.length} SHF-related URLs via map`);
        for (const link of shfLinks) {
          if (!allUrls.includes(link)) allUrls.push(link);
        }
      }
    } catch (e) {
      console.log("Map discovery failed, continuing with known URLs:", e);
    }

    console.log(`Total URLs to scrape: ${allUrls.length}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let indexed = 0;
    const errors: string[] = [];
    const companies: string[] = [];

    // Process in batches of 3 to be gentle on Firecrawl
    for (let i = 0; i < allUrls.length; i += 3) {
      const batch = allUrls.slice(i, i + 3);

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
            pageUrl;

          if (!markdown || markdown.trim().length < 50) {
            console.log(`Skipping ${pageUrl} — too little content`);
            return;
          }

          // Extract company name from title (usually "Företagsnamn - Allabolag")
          const companyName = title.replace(/ - Alla[Bb]olag.*$/, "").trim();

          // Create deterministic source_id from URL
          const encoder = new TextEncoder();
          const data = encoder.encode(pageUrl);
          const hashBuffer = await crypto.subtle.digest("SHA-256", data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
          // Format as UUID
          const sourceId = [
            hashHex.slice(0, 8),
            hashHex.slice(8, 12),
            "4" + hashHex.slice(13, 16),
            "8" + hashHex.slice(17, 20),
            hashHex.slice(20, 32),
          ].join("-");

          const { error: upsertError } = await supabase.from("content_index").upsert(
            {
              source_table: "allabolag",
              source_id: sourceId,
              title: companyName.slice(0, 500),
              content: markdown.slice(0, 10000),
              metadata: {
                url: pageUrl,
                full_title: title,
                scraped_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            },
            { onConflict: "source_table,source_id", ignoreDuplicates: false }
          );

          if (upsertError) {
            // Try insert
            const { error: insertError } = await supabase.from("content_index").insert({
              source_table: "allabolag",
              source_id: sourceId,
              title: companyName.slice(0, 500),
              content: markdown.slice(0, 10000),
              metadata: {
                url: pageUrl,
                full_title: title,
                scraped_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            });
            if (insertError) {
              errors.push(`${pageUrl}: DB error — ${insertError.message}`);
              return;
            }
          }

          indexed++;
          companies.push(companyName);
          console.log(`Indexed: ${companyName}`);
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
        total_urls: allUrls.length,
        companies,
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
