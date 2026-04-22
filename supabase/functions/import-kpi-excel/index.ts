import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ParsedRow {
  region: string;
  kpi_slug: string;
  budget: number | null;
  actual: number | null;
}

// Map common header/label variants to KPI slugs
const KPI_LABEL_MAP: Record<string, string> = {
  "driftnetto": "driftnetto",
  "driftöverskott": "driftnetto",
  "driftoverskott": "driftnetto",
  "hyresintäkter": "hyresintakter",
  "hyresintakter": "hyresintakter",
  "hyresvärde": "hyresintakter",
  "vakansgrad": "vakansgrad",
  "vakans": "vakansgrad",
  "ekonomisk vakans": "vakansgrad",
  "fastighetsvärde": "fastighetsvarde",
  "fastighetsvarde": "fastighetsvarde",
  "marknadsvärde": "fastighetsvarde",
  "optioner": "optioner",
  "option": "optioner",
  "aktiekurs": "optioner",
  "duration": "duration",
  "avtalslängd": "duration",
  "avtalslangd": "duration",
};

function normalize(s: string): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).replace(/\s|\u00a0/g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

function detectKpiSlug(label: string): string | null {
  const n = normalize(label);
  for (const [key, slug] of Object.entries(KPI_LABEL_MAP)) {
    if (n.includes(key)) return slug;
  }
  return null;
}

function extractRows(workbook: XLSX.WorkBook): ParsedRow[] {
  const rows: ParsedRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (!data.length) continue;

    // Find header row containing budget/utfall columns
    let headerRowIdx = -1;
    let regionColIdx = 0;
    let budgetColIdx = -1;
    let actualColIdx = -1;
    let kpiSlugFromSheet = detectKpiSlug(sheetName);

    for (let i = 0; i < Math.min(data.length, 15); i++) {
      const row = data[i] ?? [];
      const lower = row.map((c) => normalize(String(c ?? "")));
      const bIdx = lower.findIndex((c) => c.includes("budget"));
      const aIdx = lower.findIndex((c) => c.includes("utfall") || c.includes("faktiskt") || c.includes("actual"));
      if (bIdx >= 0 && aIdx >= 0) {
        headerRowIdx = i;
        budgetColIdx = bIdx;
        actualColIdx = aIdx;
        // region column is usually first non-empty
        regionColIdx = lower.findIndex((c) => c && !c.includes("budget") && !c.includes("utfall"));
        if (regionColIdx < 0) regionColIdx = 0;
        break;
      }
    }

    if (headerRowIdx === -1 || !kpiSlugFromSheet) continue;

    for (let i = headerRowIdx + 1; i < data.length; i++) {
      const row = data[i] ?? [];
      const region = String(row[regionColIdx] ?? "").trim();
      if (!region || normalize(region).startsWith("total") || normalize(region).startsWith("summa")) continue;
      const budget = parseNumber(row[budgetColIdx]);
      const actual = parseNumber(row[actualColIdx]);
      if (budget === null && actual === null) continue;
      rows.push({ region, kpi_slug: kpiSlugFromSheet, budget, actual });
    }
  }

  return rows;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify caller has edit permission
    const { data: { user }, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: hasPerm } = await supabase.rpc("has_module_slug_permission", { _user_id: user.id, _slug: "kpi", _permission: "edit" });
    const { data: hasAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!hasPerm && !hasAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { storage_path, year, quarter, replace = true } = body;
    if (!storage_path || !year || !quarter) {
      return new Response(JSON.stringify({ error: "Missing storage_path, year or quarter" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Download the file
    const { data: fileData, error: dlErr } = await supabase.storage.from("kpi-uploads").download(storage_path);
    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: "Could not download file: " + (dlErr?.message ?? "unknown") }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const buf = new Uint8Array(await fileData.arrayBuffer());
    const wb = XLSX.read(buf, { type: "array" });
    const rows = extractRows(wb);

    if (!rows.length) {
      return new Response(JSON.stringify({ error: "Inga rader kunde tolkas. Kontrollera att flikarna heter t.ex. 'Driftnetto', 'Hyresintäkter' osv. och innehåller kolumner för Budget och Utfall." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Lookup regions and kpi_types
    const { data: regions } = await supabase.from("regions").select("id, name");
    const { data: kpiTypes } = await supabase.from("kpi_types").select("id, slug");
    const regionMap = new Map<string, string>((regions ?? []).map((r: any) => [normalize(r.name), r.id]));
    const kpiMap = new Map<string, string>((kpiTypes ?? []).map((k: any) => [k.slug, k.id]));

    if (replace) {
      await supabase.from("kpi_data").delete().eq("year", year).eq("quarter", quarter);
    }

    const inserted: any[] = [];
    const skipped: any[] = [];
    for (const r of rows) {
      const kpi_type_id = kpiMap.get(r.kpi_slug);
      if (!kpi_type_id) { skipped.push({ ...r, reason: "kpi-typ saknas" }); continue; }
      const region_id = regionMap.get(normalize(r.region)) ?? null;
      inserted.push({
        year, quarter,
        region_id,
        region_name: r.region,
        kpi_type_id,
        budget: r.budget,
        actual: r.actual,
        created_by: user.id,
      });
    }

    const { error: insErr } = await supabase.from("kpi_data").insert(inserted);
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, inserted: inserted.length, skipped: skipped.length, sample: inserted.slice(0, 5) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
