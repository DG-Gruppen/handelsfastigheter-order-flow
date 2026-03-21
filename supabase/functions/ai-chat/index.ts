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

## Svarsformat
- Använd **markdown** för att strukturera svar: rubriker, punktlistor, fetstil för nyckelbegrepp.
- Vid steg-för-steg-instruktioner, numrera stegen.
- Använd kodblock (\`kod\`) för tekniska detaljer som URL:er, filsökvägar eller kommandon.
- Håll stycken korta och lättlästa.
- Avsluta gärna med en uppföljningsfråga om svaret kan leda till fler funderingar.

## Källhänvisning
- **VIKTIGT**: Du har tillgång till SHF:s interna kunskapsbas via kontexten nedan.
- Basera ALLTID ditt svar på kontexten om relevant information finns där.
- Referera till källan naturligt, t.ex. "Enligt vår artikel *[titel]*..." eller "I vår FAQ..."
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

/**
 * Extract search keywords from a conversational message.
 * Strips common Swedish stop-words and question patterns to improve search hits.
 */
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

  // If keyword extraction strips too much, fall back to original
  if (words.length === 0) return message;
  return words.join(" ");
}

/**
 * Build optimized context block from search results.
 * - Ensures source diversity (max 4 from same source type)
 * - Gives more content to high-relevance hits
 * - Separates extracted document content from metadata
 */
function buildContextBlock(results: any[]): string {
  if (!results || results.length === 0) return "";

  // Ensure source diversity: max 4 results per source_table
  const sourceCount: Record<string, number> = {};
  const diverse = results.filter((r: any) => {
    sourceCount[r.source_table] = (sourceCount[r.source_table] || 0) + 1;
    return sourceCount[r.source_table] <= 4;
  });

  // Adaptive content length based on relevance rank
  const entries = diverse.map((r: any, i: number) => {
    const label = SOURCE_LABELS[r.source_table] || r.source_table;
    const isExtracted =
      r.source_table === "document_files" && r.metadata?.extracted === true;

    // Top 3 results get more content, rest get less
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
    "\n--- SLUT PÅ KONTEXT ---"
  );
}

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

    // Get the latest user message for search
    const lastUserMsg = [...messages]
      .reverse()
      .find((m: any) => m.role === "user");
    let contextBlock = "";

    if (lastUserMsg?.content) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Extract keywords for better search precision
      const keywords = extractKeywords(lastUserMsg.content);

      // Run two searches in parallel: keywords + original message
      const [keywordResults, fullResults] = await Promise.all([
        supabase.rpc("search_content", {
          query_text: keywords,
          match_limit: 10,
        }),
        // Only do full-message search if keywords differ significantly
        keywords !== lastUserMsg.content
          ? supabase.rpc("search_content", {
              query_text: lastUserMsg.content,
              match_limit: 6,
            })
          : Promise.resolve({ data: [] }),
      ]);

      // Merge and deduplicate results, keeping highest relevance
      const resultMap = new Map<string, any>();
      for (const r of keywordResults.data || []) {
        const key = `${r.source_table}:${r.source_id}`;
        resultMap.set(key, r);
      }
      for (const r of (fullResults as any).data || []) {
        const key = `${r.source_table}:${r.source_id}`;
        const existing = resultMap.get(key);
        if (!existing || r.relevance > existing.relevance) {
          resultMap.set(key, r);
        }
      }

      // Sort merged results by relevance
      const merged = Array.from(resultMap.values()).sort(
        (a, b) => b.relevance - a.relevance
      );

      contextBlock = buildContextBlock(merged.slice(0, 12));
    }

    const systemMessage = SYSTEM_PROMPT + contextBlock;

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
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "För många förfrågningar, försök igen senare.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI-krediter slut. Kontakta administratör.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({
          error: "AI-tjänsten är inte tillgänglig just nu.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Okänt fel",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
