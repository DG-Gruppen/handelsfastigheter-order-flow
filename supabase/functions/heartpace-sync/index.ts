// Heartpace HR sync — verifierar anslutning + matchar anställda mot profiles på e-post
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const HEARTPACE_BASE = "https://sync.heartpace.com/v1/api";
const SUBDOMAIN = "svenskahandelsfastigheter";

async function hpFetch(path: string, token: string) {
  const res = await fetch(`${HEARTPACE_BASE}${path}`, {
    headers: {
      accept: "application/json",
      "X-Subdomain": SUBDOMAIN,
      Authorization: `Bearer ${token}`,
      "X-CSRF-TOKEN": "",
    },
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) {
    throw new Error(`Heartpace ${path} ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

async function updateStatus(
  supa: ReturnType<typeof createClient>,
  patch: Record<string, unknown>,
) {
  await supa
    .from("integration_status")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("slug", "heartpace");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "test";

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = Deno.env.get("HEARTPACE_API_KEY");

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

  if (!token) {
    await updateStatus(supa, { status: "error", last_error: "HEARTPACE_API_KEY saknas", error_count: 1 });
    return new Response(JSON.stringify({ ok: false, error: "HEARTPACE_API_KEY saknas" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (action === "test" || action === "debug") {
      // Liten begäran för att verifiera autentisering
      const data = await hpFetch("/employees/employment-info?limit=2&offset=0", token);
      const items: any[] = Array.isArray((data as any)?.data) ? (data as any).data
                          : Array.isArray(data) ? (data as any) : [];

      await updateStatus(supa, {
        status: "ok",
        last_sync_at: new Date().toISOString(),
        last_error: null,
        error_count: 0,
        metadata: { last_action: action, sample_count: items.length },
      });

      return new Response(JSON.stringify({
        ok: true,
        message: "Anslutning OK",
        sample_count: items.length,
        sample_keys: items[0] ? Object.keys(items[0]) : [],
        sample: action === "debug" ? items.slice(0, 2) : undefined,
        raw_top_level_keys: data && typeof data === "object" ? Object.keys(data as any) : null,
      }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (action === "match") {
      // Hämta alla anställningar (paginerat)
      const limit = 200;
      let offset = 0;
      const all: any[] = [];
      while (true) {
        const page: any = await hpFetch(`/employees/employment-info?limit=${limit}&offset=${offset}`, token);
        const items: any[] = Array.isArray(page?.data) ? page.data : Array.isArray(page) ? page : [];
        all.push(...items);
        if (items.length < limit) break;
        offset += limit;
        if (offset > 5000) break; // safety
      }

      // Bygg email→id-map
      const byEmail = new Map<string, string>();
      for (const emp of all) {
        const email: string | undefined =
          emp.email || emp.workEmail || emp.work_email || emp.user?.email;
        const id: string | undefined =
          emp.employeeId || emp.employee_id || emp.id || emp.userId || emp.user_id;
        if (email && id) byEmail.set(String(email).toLowerCase().trim(), String(id));
      }

      // Hämta profiler utan heartpace_employee_id
      const { data: profiles, error: pErr } = await supa
        .from("profiles")
        .select("id, email, heartpace_employee_id")
        .is("heartpace_employee_id", null);
      if (pErr) throw pErr;

      let matched = 0;
      const updates: Array<{ id: string; heartpace_employee_id: string }> = [];
      for (const p of profiles ?? []) {
        const key = (p.email ?? "").toLowerCase().trim();
        const hpId = byEmail.get(key);
        if (hpId) {
          updates.push({ id: p.id, heartpace_employee_id: hpId });
          matched++;
        }
      }

      // Skriv i batchar
      for (const u of updates) {
        const { error: uErr } = await supa
          .from("profiles")
          .update({ heartpace_employee_id: u.heartpace_employee_id })
          .eq("id", u.id);
        if (uErr) console.error("Update failed for", u.id, uErr.message);
      }

      const unmatchedHp = all.length - matched;
      await updateStatus(supa, {
        status: "ok",
        last_sync_at: new Date().toISOString(),
        last_error: null,
        error_count: 0,
        metadata: {
          last_action: "match",
          heartpace_total: all.length,
          newly_matched: matched,
          unmatched_in_heartpace: Math.max(unmatchedHp, 0),
        },
      });

      return new Response(JSON.stringify({
        ok: true,
        heartpace_total: all.length,
        newly_matched: matched,
        profiles_checked: profiles?.length ?? 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: false, error: `Okänd action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateStatus(supa, { status: "error", last_error: msg, error_count: 1 });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
