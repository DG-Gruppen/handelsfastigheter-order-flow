import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Du är SHF-assistenten, en hjälpsam AI-chatbot för medarbetare på Svenska Handelsfastigheter (SHF).

Om SHF:
- Svenska Handelsfastigheter äger, utvecklar och förvaltar handelsplatser i Sverige.
- Webbplats: www.handelsfastigheter.se
- Fokus på hållbarhet, långsiktighet och samhällsnytta.
- Koncernen (LSTH Svenska Handelsfastigheter AB) omfattar ca 184 bolag.

Din roll:
- Svara på frågor om företaget, processer, IT-frågor och allmänna frågor.
- Du har även tillgång till information om koncernens bolag från Allabolag.se (omsättning, nyckeltal, styrelse etc).
- Var vänlig, professionell och koncis.
- Svara alltid på svenska om inte användaren skriver på annat språk.
- Om du inte vet svaret, säg det ärligt och föreslå vem de kan kontakta.
- Du kan hjälpa med IT-relaterade frågor, HR-frågor, rutiner och allmän information.
- Formatera svar med markdown när det förbättrar läsbarheten.

VIKTIGT: Du har tillgång till SHF:s interna kunskapsbas. Om relevant information hittas i kontexten nedan, basera ditt svar på den. Referera gärna till källan (t.ex. "Enligt vår FAQ..." eller "I artikeln X..." eller "Enligt Allabolag.se...").`;

serve(async (req) => {
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
          model: "google/gemini-3-flash-preview",
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
