import { createClient } from "npm:@supabase/supabase-js@2";

const PRIMARY_ORIGIN = "https://intra.handelsfastigheter.se";

const isAllowedOrigin = (origin: string | null) => {
  if (!origin) return false;
  return (
    origin === PRIMARY_ORIGIN ||
    origin === "https://handelsfastigheter.lovable.app" ||
    origin.endsWith(".lovableproject.com") ||
    origin.endsWith(".lovable.app") ||
    origin === "http://localhost:5173"
  );
};

const getCorsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : PRIMARY_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  Vary: "Origin",
});

const SYSTEM_PROMPT = `Du är SHF-assistenten, en hjälpsam och kunnig AI-chatbot för medarbetare på Svenska Handelsfastigheter (SHF).

## Om SHF
- Svenska Handelsfastigheter äger, utvecklar och förvaltar handelsplatser i Sverige.
- Webbplats: www.handelsfastigheter.se
- Fokus på hållbarhet, långsiktighet och samhällsnytta.
- Koncernen (LSTH Svenska Handelsfastigheter AB) omfattar ca 184 bolag.

## Din roll och personlighet
- Du är en vänlig, professionell och proaktiv kollega som brinner för att hjälpa.
- Svara alltid på svenska om inte användaren skriver på ett annat språk.
- Var konkret och handlingsinriktad – ge tydliga steg och instruktioner där det är möjligt.
- Anpassa detaljnivån efter frågans komplexitet: korta svar på enkla frågor, utförliga svar på komplexa.

## Kunskapsområden
Du kan hjälpa med:
- **IT & system**: Felsökning, inloggning, VPN, programvara, utrustningsbeställningar, systemfrågor.
- **HR & personal**: Rutiner, policies, onboarding, ledighet, förmåner.
- **Fastigheter & projekt**: Information om koncernens fastigheter, projekt och bolag.
- **Processer & rutiner**: Interna arbetsflöden, beställningar, godkännanden.
- **Bolagsinformation**: Nyckeltal, styrelseuppgifter och ekonomisk data från Allabolag.se.
- **Nyheter**: Interna nyheter och uppdateringar publicerade i intranätet.
- **VD-bloggen**: Inlägg och uppdateringar från VD.
- **Verktyg**: Information om interna verktyg, system och deras användning.
- **Dokument**: Information baserat på faktiskt innehåll i uppladdade dokument (personalhandbok, bilpolicy, rutiner mm).
- **Organisation**: Avdelningar, organisationsstruktur, roller.
- **Allmänt**: Kontaktuppgifter, kultur och värderingar.
- **Webb**: Publik information om SHF hämtad från webben (pressmeddelanden, nyheter, branschinfo).

## Svarsformat
- Använd **markdown** för att strukturera svar: rubriker, punktlistor, fetstil för nyckelbegrepp.
- Vid steg-för-steg-instruktioner, numrera stegen.
- Använd kodblock (\`kod\`) för tekniska detaljer som URL:er, filsökvägar eller kommandon.
- Håll stycken korta och lättlästa.
- Avsluta gärna med en uppföljningsfråga om svaret kan leda till fler funderingar.

## Källhänvisning
- **VIKTIGT**: Du har tillgång till SHF:s interna kunskapsbas OCH webbsökresultat via kontexten nedan.
- Basera ALLTID ditt svar på kontexten om relevant information finns där.
- Referera till källan naturligt, t.ex. "Enligt vår artikel *[titel]*..." eller "I vår FAQ..." eller "Enligt en artikel på webben..."
- Markera tydligt om information kommer från **intern källa** vs **webbsökning** så användaren förstår tillförlitligheten.
- Om du INTE hittar svaret i kontexten och inte heller kan svara med allmän kunskap, säg ärligt att du inte vet och föreslå vem de kan kontakta (IT-support, HR eller närmaste chef).
- Hitta INTE på information. Gissa aldrig på interna rutiner eller policyer.
- Om kontexten innehåller dokumentinnehåll (markerat som "Dokument"), prioritera det framför metadata-poster.`;

const SOURCE_LABELS: Record<string, string> = {
  kb_articles: "Kunskapsbanken (artikel)",
  it_faq: "IT FAQ",
  kb_videos: "Kunskapsbanken (video)",
  website: "Webbplatsen (handelsfastigheter.se)",
  allabolag: "Allabolag.se (bolagsinfo)",
  news: "Nyheter (internt)",
  ceo_blog: "VD-bloggen",
  tools: "Verktyg & system",
  departments: "Avdelningar",
  document_folders: "Dokumentbiblioteket (mapp)",
  document_files: "Dokumentbiblioteket (dokument)",
};

// ── Keyword extraction ──────────────────────────────────────────────

function extractKeywords(message: string): string {
  const stopWords = new Set([
    "jag", "vill", "kan", "du", "hur", "var", "vad", "när", "varför",
    "finns", "det", "den", "de", "ett", "en", "att", "och", "eller",
    "med", "för", "om", "på", "av", "till", "från", "är", "har", "ska",
    "vi", "ni", "man", "sig", "sin", "sitt", "sina", "som", "inte",
    "min", "mitt", "mina", "din", "ditt", "dina", "denna", "detta",
    "dessa", "hela", "alla", "lite", "mycket", "mer", "mest", "bara",
    "också", "sedan", "efter", "före", "under", "över", "mellan",
    "hittar", "hitta", "berätta", "visa", "förklara", "hjälp", "hjälpa",
    "tack", "hej", "hejsan", "snälla", "gärna", "behöver", "veta",
    "information", "info", "fråga", "undrar", "undra", "skulle",
  ]);

  const words = message
    .toLowerCase()
    .replace(/[?!.,;:"""''()[\]{}]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w));

  if (words.length === 0) return message;
  return words.join(" ");
}

// ── AI Query Rewriting ──────────────────────────────────────────────

async function rewriteQuery(
  userMessage: string,
  conversationContext: string,
  apiKey: string,
): Promise<string[]> {
  try {
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `Du är en sökoptimerings-AI. Givet en användares fråga och konversationshistorik, generera 2-3 optimerade sökfrågor på svenska som fångar användarens intention. Svara BARA med sökfrågorna, en per rad. Inga numreringar, inga förklaringar. Tänk på synonymer och relaterade termer.`,
            },
            {
              role: "user",
              content: conversationContext
                ? `Konversation:\n${conversationContext}\n\nSenaste fråga: ${userMessage}`
                : userMessage,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      console.error("Query rewrite failed:", response.status);
      return [userMessage];
    }

    const data = await response.json();
    const rewritten = data.choices?.[0]?.message?.content?.trim();
    if (!rewritten) return [userMessage];

    const queries = rewritten
      .split("\n")
      .map((q: string) => q.trim())
      .filter((q: string) => q.length > 2);

    console.log("Rewritten queries:", queries);
    return queries.length > 0 ? queries : [userMessage];
  } catch (e) {
    console.error("Query rewrite error:", e);
    return [userMessage];
  }
}

// ── AI Re-ranking ───────────────────────────────────────────────────

async function rerankResults(
  userMessage: string,
  results: any[],
  apiKey: string,
): Promise<any[]> {
  if (results.length <= 3) return results;

  try {
    const summaries = results.slice(0, 15).map((r, i) => {
      const label = SOURCE_LABELS[r.source_table] || r.source_table;
      const snippet = r.content.length > 300 ? r.content.slice(0, 300) + "…" : r.content;
      return `[${i}] ${label}: "${r.title}" — ${snippet}`;
    });

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `Du är en relevans-bedömare. Givet en fråga och en lista av sökresultat, returnera indexnumren för de mest relevanta resultaten i relevansordning. Svara BARA med kommaseparerade siffror, t.ex. "3,0,7,1". Välj max 6 resultat. Inga förklaringar.`,
            },
            {
              role: "user",
              content: `Fråga: ${userMessage}\n\nResultat:\n${summaries.join("\n")}`,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      console.error("Re-rank failed:", response.status);
      return results;
    }

    const data = await response.json();
    const ranking = data.choices?.[0]?.message?.content?.trim();
    if (!ranking) return results;

    const indices = ranking
      .split(/[,\s]+/)
      .map((s: string) => parseInt(s.trim(), 10))
      .filter((n: number) => !isNaN(n) && n >= 0 && n < results.length);

    if (indices.length === 0) return results;

    // Build re-ranked list, then append any remaining results
    const seen = new Set<number>();
    const reranked: any[] = [];
    for (const idx of indices) {
      if (!seen.has(idx)) {
        seen.add(idx);
        reranked.push(results[idx]);
      }
    }
    // Append rest that weren't selected
    for (let i = 0; i < results.length && reranked.length < 12; i++) {
      if (!seen.has(i)) reranked.push(results[i]);
    }

    console.log("Re-ranked order:", indices);
    return reranked;
  } catch (e) {
    console.error("Re-rank error:", e);
    return results;
  }
}

// ── Context building ────────────────────────────────────────────────

function buildContextBlock(results: any[]): string {
  if (!results || results.length === 0) return "";

  const sourceCount: Record<string, number> = {};
  const diverse = results.filter((r: any) => {
    sourceCount[r.source_table] = (sourceCount[r.source_table] || 0) + 1;
    return sourceCount[r.source_table] <= 4;
  });

  const entries = diverse.map((r: any, i: number) => {
    const label = SOURCE_LABELS[r.source_table] || r.source_table;
    const isExtracted =
      r.source_table === "document_files" && r.metadata?.extracted === true;

    let maxChars: number;
    if (i < 3) maxChars = 4000;
    else if (i < 6) maxChars = 2000;
    else maxChars = 1000;

    const contentSnippet = r.content.length > maxChars
      ? r.content.slice(0, maxChars) + "…"
      : r.content;

    const extractedTag = isExtracted ? " [fulltext]" : "";

    return `[${i + 1}] ${label}${extractedTag}: "${r.title}" (relevans: ${r.relevance?.toFixed(2) ?? "?"})\n${contentSnippet}`;
  });

  return (
    "\n\n--- INTERN KUNSKAPSBAS (kontext) ---\n" +
    entries.join("\n\n") +
    "\n--- SLUT PÅ INTERN KONTEXT ---"
  );
}

// ── Web search decision ─────────────────────────────────────────────

function shouldSearchWeb(results: any[], userMessage: string): boolean {
  if (!results || results.length === 0) return true;
  const topRelevance = results[0]?.relevance ?? 0;
  if (topRelevance < 0.5) return true;
  const meaningfulResults = results.filter((r) => (r.relevance ?? 0) > 0.3);
  if (meaningfulResults.length < 2) return true;
  const webHintWords = [
    "nyheter", "press", "bransch", "marknad", "konkurrent",
    "senaste", "aktuellt", "publik", "extern", "omvärlden",
    "fastighetsbransch", "webb", "internet", "google",
  ];
  const lower = userMessage.toLowerCase();
  if (webHintWords.some((w) => lower.includes(w))) return true;
  return false;
}

// ── Web search via Firecrawl ────────────────────────────────────────

async function searchWeb(query: string): Promise<string> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    console.log("FIRECRAWL_API_KEY not set, skipping web search");
    return "";
  }

  try {
    const webQuery = `Svenska Handelsfastigheter ${query}`;
    console.log("Firecrawl web search:", webQuery);

    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: webQuery,
        limit: 5,
        scrapeOptions: { formats: ["markdown"] },
      }),
    });

    if (!response.ok) {
      console.error("Firecrawl search failed:", response.status);
      return "";
    }

    const data = await response.json();
    const results = data?.data || [];
    if (results.length === 0) return "";

    const entries = results
      .filter((r: any) => r.title || r.markdown || r.description)
      .slice(0, 4)
      .map((r: any, i: number) => {
        const content = r.markdown
          ? r.markdown.slice(0, 2000)
          : r.description || "";
        const url = r.url || "";
        return `[W${i + 1}] Webbkälla: "${r.title || "Utan titel"}" (${url})\n${content}`;
      });

    if (entries.length === 0) return "";

    return (
      "\n\n--- WEBBSÖKRESULTAT (externa källor) ---\n" +
      entries.join("\n\n") +
      "\n--- SLUT PÅ WEBBSÖKRESULTAT ---"
    );
  } catch (e) {
    console.error("Web search error:", e);
    return "";
  }
}

// ── Conversation context helper ─────────────────────────────────────

function getConversationContext(messages: any[]): string {
  // Get last 4 messages for context (excluding current)
  const recent = messages.slice(-5, -1);
  if (recent.length === 0) return "";
  return recent
    .map((m: any) => `${m.role === "user" ? "Användare" : "Assistent"}: ${m.content.slice(0, 200)}`)
    .join("\n");
}

// ── Main handler ────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const lastUserMsg = [...messages]
      .reverse()
      .find((m: any) => m.role === "user");
    let contextBlock = "";
    let webBlock = "";

    if (lastUserMsg?.content) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Step 1: AI Query Rewriting — generate optimized search queries
      const conversationCtx = getConversationContext(messages);
      const [rewrittenQueries, basicKeywords] = await Promise.all([
        rewriteQuery(lastUserMsg.content, conversationCtx, LOVABLE_API_KEY),
        Promise.resolve(extractKeywords(lastUserMsg.content)),
      ]);

      // Step 2: Run all search queries in parallel (rewritten + basic keywords)
      const allQueries = [...new Set([basicKeywords, ...rewrittenQueries])];
      console.log("Search queries:", allQueries);

      const searchPromises = allQueries.map((q) =>
        supabase.rpc("search_content", {
          query_text: q,
          match_limit: 10,
        })
      );
      const searchResults = await Promise.all(searchPromises);

      // Merge and deduplicate across all queries
      const resultMap = new Map<string, any>();
      for (const res of searchResults) {
        for (const r of res.data || []) {
          const key = `${r.source_table}:${r.source_id}`;
          const existing = resultMap.get(key);
          if (!existing || r.relevance > existing.relevance) {
            resultMap.set(key, r);
          }
        }
      }

      let merged = Array.from(resultMap.values()).sort(
        (a, b) => b.relevance - a.relevance,
      );

      // Step 3: AI Re-ranking — let AI pick the most relevant results
      if (merged.length > 3) {
        merged = await rerankResults(lastUserMsg.content, merged, LOVABLE_API_KEY);
      }

      contextBlock = buildContextBlock(merged.slice(0, 10));

      // Step 4: Web search if internal results are weak
      if (shouldSearchWeb(merged, lastUserMsg.content)) {
        console.log("Internal results weak, performing web search...");
        webBlock = await searchWeb(basicKeywords);
      }
    }

    const systemMessage = SYSTEM_PROMPT + contextBlock + webBlock;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: Deno.env.get("AI_MODEL") ?? "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemMessage },
            ...messages,
          ],
          stream: true,
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "För många förfrågningar, försök igen senare." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI-krediter slut. Kontakta administratör." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI-tjänsten är inte tillgänglig just nu." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Okänt fel" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
