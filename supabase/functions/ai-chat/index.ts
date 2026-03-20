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
  "Vary": "Origin",
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
- **Dokument**: Information om dokument och filer i dokumentbiblioteket.
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
- Hitta INTE på information. Gissa aldrig på interna rutiner eller policyer.`;

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
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    let contextBlock = "";

    if (lastUserMsg?.content) {
      // Search the content index using service role
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: results } = await supabase.rpc("search_content", {
        query_text: lastUserMsg.content,
        match_limit: 5,
      });

      if (results && results.length > 0) {
        const sourceLabels: Record<string, string> = {
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
          document_files: "Dokumentbiblioteket (fil)",
        };

        contextBlock = "\n\n--- INTERN KUNSKAPSBAS (kontext) ---\n" +
          results.map((r: any, i: number) =>
            `[${i + 1}] ${sourceLabels[r.source_table] || r.source_table}: "${r.title}"\n${r.content.slice(0, 800)}`
          ).join("\n\n") +
          "\n--- SLUT PÅ KONTEXT ---";
      }
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
          model: Deno.env.get("AI_MODEL") ?? "google/gemini-3-flash-preview",
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
          JSON.stringify({ error: "För många förfrågningar, försök igen senare." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI-krediter slut. Kontakta administratör." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI-tjänsten är inte tillgänglig just nu." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Okänt fel" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
