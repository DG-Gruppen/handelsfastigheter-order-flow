// Synkar personalfält (titel, telefon, födelsedag, anställningsdatum) från Heartpace.
// Matchar via profiles.heartpace_employee_id. Skriver alltid över.
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

const toDate = (v: unknown): string | null => {
  if (!v || typeof v !== "string") return null;
  const m = v.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = Deno.env.get("HEARTPACE_API_KEY");
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "HEARTPACE_API_KEY saknas" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1) Hämta alla anställningar
    const limit = 200;
    let offset = 0;
    const all: any[] = [];
    while (true) {
      const page: any = await hpFetch(`/employees/employment-info?limit=${limit}&offset=${offset}`, token);
      const items: any[] = Array.isArray(page?.data) ? page.data : Array.isArray(page) ? page : [];
      all.push(...items);
      if (items.length < limit) break;
      offset += limit;
      if (offset > 5000) break;
    }
    const active = all.filter((e) => e?.is_current === true && e?.user_account?.account_status === 1);

    // 2a) Slå upp lokala avdelningsnamn via heartpace_uuid
    const { data: localDepts } = await supa
      .from("departments")
      .select("name, heartpace_uuid")
      .not("heartpace_uuid", "is", null);
    const deptNameByHpUuid = new Map<string, string>();
    for (const d of localDepts ?? []) {
      if (d.heartpace_uuid) deptNameByHpUuid.set(String(d.heartpace_uuid), d.name);
    }

    // 2b) Bygg fältmap per Heartpace user_account.uuid
    type HpFields = {
      title: string | null;
      phone: string | null;
      birthday: string | null;
      start_date: string | null;
      department: string | null;
      full_name: string | null;
      email: string | null;
    };
    const byHpId = new Map<string, HpFields>();
    for (const emp of active) {
      const ua = emp?.user_account ?? {};
      const pd = ua?.personal_data ?? {};
      const jis: any[] = Array.isArray(emp?.job_informations) ? emp.job_informations : [];
      const ji = jis.find((j) => j?.is_current) ?? jis[0];

      const phone = pd.work_phone || pd.mobile_work_phone || pd.mobile_phone || null;
      const hpDeptUuid: string | undefined = ji?.department?.uuid;
      const hpDeptName: string | null = ji?.department?.name ?? null;
      // Föredra lokalt avdelningsnamn (matchat via heartpace_uuid), fall tillbaka till Heartpaces namn
      const department = (hpDeptUuid && deptNameByHpUuid.get(hpDeptUuid)) || hpDeptName;

      const first = (pd.first_name ?? ua.first_name ?? "").toString().trim();
      const last = (pd.last_name ?? ua.last_name ?? "").toString().trim();
      const full_name = [first, last].filter(Boolean).join(" ") || null;
      const email = pd.work_email || null;

      const fields: HpFields = {
        title: ji?.position?.name ?? null,
        phone: phone ? String(phone).trim() : null,
        birthday: toDate(pd.birth_date),
        start_date: toDate(emp?.start_date) ?? toDate(ua?.hire_date) ?? toDate(ua?.actual_hire_date),
        department: department ?? null,
        full_name,
        email: email ? String(email).toLowerCase().trim() : null,
      };
      const hpId: string | undefined = ua.uuid || (ua.id != null ? String(ua.id) : undefined);
      if (hpId) byHpId.set(hpId, fields);
    }

    // 3) Hämta profiler med heartpace_employee_id (exkludera externa och flaggade konton)
    const { data: profiles, error: pErr } = await supa
      .from("profiles")
      .select("id, heartpace_employee_id, title_override, phone, birthday, start_date, department, full_name, email")
      .not("heartpace_employee_id", "is", null)
      .eq("heartpace_sync_excluded", false)
      .eq("is_external", false);
    if (pErr) throw pErr;

    let updated = 0, noMatch = 0, unchanged = 0;
    const changes: Record<string, number> = { title_override: 0, phone: 0, birthday: 0, start_date: 0, department: 0, full_name: 0, email: 0 };

    for (const p of profiles ?? []) {
      const hp = byHpId.get(p.heartpace_employee_id as string);
      if (!hp) { noMatch++; continue; }
      const patch: Record<string, unknown> = {};
      if (hp.title !== null && hp.title !== p.title_override) { patch.title_override = hp.title; changes.title_override++; }
      if (hp.phone !== null && hp.phone !== p.phone) { patch.phone = hp.phone; changes.phone++; }
      if (hp.birthday !== null && hp.birthday !== (p.birthday ?? null)) { patch.birthday = hp.birthday; changes.birthday++; }
      if (hp.start_date !== null && hp.start_date !== (p.start_date ?? null)) { patch.start_date = hp.start_date; changes.start_date++; }
      if (hp.department !== null && hp.department !== (p.department ?? null)) { patch.department = hp.department; changes.department++; }
      if (hp.full_name !== null && hp.full_name !== p.full_name) { patch.full_name = hp.full_name; changes.full_name++; }
      if (hp.email !== null && hp.email !== (p.email ?? "").toLowerCase()) { patch.email = hp.email; changes.email++; }
      if (Object.keys(patch).length === 0) { unchanged++; continue; }
      const { error } = await supa.from("profiles").update(patch).eq("id", p.id);
      if (!error) updated++;
    }

    return new Response(JSON.stringify({
      ok: true,
      heartpace_active: active.length,
      profiles_checked: profiles?.length ?? 0,
      updated, unchanged, no_match: noMatch,
      field_changes: changes,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message
      : (e && typeof e === "object") ? JSON.stringify(e)
      : String(e);
    console.error("sync-personnel error:", msg, e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
