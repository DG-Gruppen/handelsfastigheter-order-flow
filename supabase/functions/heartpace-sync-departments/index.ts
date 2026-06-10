// Synkar `departments` mot Heartpace och uppdaterar profiles.department
// för matchade anställda. IT/Support bevaras alltid.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const HEARTPACE_BASE = "https://sync.heartpace.com/v1/api";
const SUBDOMAIN = "svenskahandelsfastigheter";
const PRESERVED_DEPT_NAME = "IT/Support";
const PARENT_GROUPS: Array<{ prefix: string; parent: string }> = [
  { prefix: "Förvaltningen ", parent: "Förvaltning" },
];

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

    // 2) Bygg dept-map: uuid -> {name, color}
    const deptByUuid = new Map<string, { uuid: string; name: string; color?: string }>();
    // Bygg uuid-per-anställd: user_account.uuid -> dept.uuid
    const empDeptByHpId = new Map<string, string>();

    for (const emp of active) {
      const jis: any[] = Array.isArray(emp?.job_informations) ? emp.job_informations : [];
      const ji = jis.find((j) => j?.is_current) ?? jis[0];
      const d = ji?.department;
      if (!d?.uuid) continue;
      if (!deptByUuid.has(d.uuid)) {
        deptByUuid.set(d.uuid, { uuid: d.uuid, name: d.name, color: d.color });
      }
      const hpEmpId: string | undefined = emp?.user_account?.uuid ?? (emp?.user_account?.id != null ? String(emp.user_account.id) : undefined);
      if (hpEmpId) empDeptByHpId.set(hpEmpId, d.uuid);
    }

    // 3) Upsert departments (matcha på heartpace_uuid)
    const { data: existing, error: exErr } = await supa
      .from("departments")
      .select("id, name, heartpace_uuid, parent_id, color");
    if (exErr) throw exErr;

    const byHpUuid = new Map<string, any>();
    const byName = new Map<string, any>();
    for (const row of existing ?? []) {
      if (row.heartpace_uuid) byHpUuid.set(row.heartpace_uuid, row);
      byName.set(row.name, row);
    }

    // Säkerställ parent-mappning (Förvaltning)
    const parentIdByName = new Map<string, string>();
    for (const { parent } of PARENT_GROUPS) {
      const p = byName.get(parent);
      if (p) parentIdByName.set(parent, p.id);
    }

    const finalDeptIdByHpUuid = new Map<string, string>();
    let inserted = 0, updated = 0;

    for (const d of deptByUuid.values()) {
      const parentName = PARENT_GROUPS.find((g) => d.name.startsWith(g.prefix))?.parent;
      const parent_id = parentName ? parentIdByName.get(parentName) ?? null : null;
      const color = d.color ? `#${d.color}` : null;

      let row = byHpUuid.get(d.uuid);
      // Adoptera ev. befintlig rad med samma namn men utan heartpace_uuid
      if (!row) {
        const existingByName = byName.get(d.name);
        if (existingByName && !existingByName.heartpace_uuid) row = existingByName;
      }

      if (row) {
        const { data: upd, error } = await supa
          .from("departments")
          .update({
            name: d.name,
            heartpace_uuid: d.uuid,
            parent_id,
            color: color ?? row.color,
          })
          .eq("id", row.id)
          .select("id")
          .single();
        if (error) throw error;
        finalDeptIdByHpUuid.set(d.uuid, upd.id);
        updated++;
      } else {
        const { data: ins, error } = await supa
          .from("departments")
          .insert({ name: d.name, heartpace_uuid: d.uuid, parent_id, color })
          .select("id")
          .single();
        if (error) throw error;
        finalDeptIdByHpUuid.set(d.uuid, ins.id);
        inserted++;
      }
    }

    // 4) Ta bort gamla avdelningar som inte finns i Heartpace, utom IT/Support.
    // Flytta först profiler från en sådan dept till NULL? Kolumnen är text, så bara
    // namnreferenser — ingen FK. Vi tar bort raderna direkt.
    const hpNames = new Set(Array.from(deptByUuid.values()).map((d) => d.name));
    const toDelete = (existing ?? []).filter((r) => {
      if (r.name === PRESERVED_DEPT_NAME) return false;
      if (r.heartpace_uuid && deptByUuid.has(r.heartpace_uuid)) return false;
      if (hpNames.has(r.name)) return false; // adopterades ovan
      return true;
    });
    let deleted = 0;
    for (const row of toDelete) {
      // Försök rensa barn först (parent_id pekande hit)
      await supa.from("departments").update({ parent_id: null }).eq("parent_id", row.id);
      const { error } = await supa.from("departments").delete().eq("id", row.id);
      if (!error) deleted++;
    }

    // 5) Uppdatera profiles.department för matchade anställda (utom IT/Support-medlemmar)
    const { data: profiles, error: pErr } = await supa
      .from("profiles")
      .select("id, department, heartpace_employee_id")
      .not("heartpace_employee_id", "is", null);
    if (pErr) throw pErr;

    let profilesUpdated = 0, profilesSkippedIt = 0, profilesNoMatch = 0;
    for (const p of profiles ?? []) {
      if (p.department === PRESERVED_DEPT_NAME) { profilesSkippedIt++; continue; }
      const hpDeptUuid = empDeptByHpId.get(p.heartpace_employee_id as string);
      if (!hpDeptUuid) { profilesNoMatch++; continue; }
      const dept = deptByUuid.get(hpDeptUuid);
      if (!dept) { profilesNoMatch++; continue; }
      if (p.department === dept.name) continue;
      const { error } = await supa.from("profiles").update({ department: dept.name }).eq("id", p.id);
      if (!error) profilesUpdated++;
    }

    return new Response(JSON.stringify({
      ok: true,
      departments: {
        heartpace_total: deptByUuid.size,
        inserted, updated, deleted,
      },
      profiles: {
        updated: profilesUpdated,
        skipped_it: profilesSkippedIt,
        no_match: profilesNoMatch,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
