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

function normalize(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).replace(/\s|\u00a0/g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  if (!s || s === "-" || s === ".") return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

function round2(n: number | null): number | null {
  return n === null ? null : Math.round(n * 100) / 100;
}

/** "Nord" -> "Region Nord", "Total" -> "Totalt" */
function canonicalRegion(raw: string): string | null {
  const n = normalize(raw);
  if (!n) return null;
  if (n.includes("nord")) return "Region Nord";
  if (n.includes("mitt")) return "Region Mitt";
  if (n.includes("syd")) return "Region Syd";
  if (n.startsWith("total")) return "Totalt";
  return null;
}

type Key = string; // `${slug}|${region}`
type Acc = Map<Key, ParsedRow>;

function put(
  acc: Acc,
  slug: string,
  region: string,
  field: "budget" | "actual",
  value: number | null,
) {
  if (value === null) return;
  const key = `${slug}|${region}`;
  const existing = acc.get(key) ?? { region, kpi_slug: slug, budget: null, actual: null };
  if (existing[field] === null) existing[field] = value;
  acc.set(key, existing);
}

function sheetRows(wb: XLSX.WorkBook, name: string): any[][] | null {
  const match = wb.SheetNames.find((s) => normalize(s) === normalize(name));
  if (!match) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[match], { header: 1, defval: null }) as any[][];
}

/** "Sammanställning": one block per quarter with region columns. */
function parseSummary(wb: XLSX.WorkBook, quarter: number, acc: Acc) {
  const data = sheetRows(wb, "Sammanställning");
  if (!data) return;

  // Locate the block for the requested quarter
  let start = -1;
  for (let i = 0; i < data.length; i++) {
    const cells = (data[i] ?? []).map(normalize);
    if (cells.some((c) => c === `q${quarter}`)) {
      start = i;
      break;
    }
  }
  if (start === -1) return;

  // Header row with region names (next row containing a known region)
  let headerIdx = -1;
  const regionCols: Record<number, string> = {};
  for (let i = start + 1; i < Math.min(start + 4, data.length); i++) {
    const row = data[i] ?? [];
    const found: Record<number, string> = {};
    row.forEach((cell, idx) => {
      const r = canonicalRegion(String(cell ?? ""));
      if (r) found[idx] = r;
    });
    if (Object.keys(found).length >= 2) {
      headerIdx = i;
      Object.assign(regionCols, found);
      break;
    }
  }
  if (headerIdx === -1) return;

  const readRow = (
    row: any[],
    slug: string,
    field: "budget" | "actual",
    factor = 1,
    includeTotal = false,
  ) => {
    for (const [idxStr, region] of Object.entries(regionCols)) {
      if (region === "Totalt" && !includeTotal) continue;
      const value = parseNumber(row[Number(idxStr)]);
      put(acc, slug, region, field, value === null ? null : round2(value * factor));
    }
  };

  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i] ?? [];
    const label = normalize(row.find((c, idx) => idx > 0 && c) ?? "");
    // Stop when the next quarter block begins
    if (row.some((c) => /^q[1-4]$/.test(normalize(c)))) break;
    if (!label) continue;

    if (label === "driftnetto utfall") readRow(row, "driftnetto", "actual");
    else if (label === "driftnetto budget") readRow(row, "driftnetto", "budget");
    else if (label === "ög utfall" || label === "överskottsgrad utfall") readRow(row, "overskottsgrad", "actual", 100);
    else if (label === "ög budget" || label === "överskottsgrad budget") readRow(row, "overskottsgrad", "budget", 100);
    else if (label === "vakansgrad") readRow(row, "vakansgrad", "actual", 100);
    else if (label === "duration") readRow(row, "duration", "actual");
    else if (label.startsWith("fastighetsvärde")) readRow(row, "fastighetsvarde", "actual", 1000);
  }
}

/** "Fastigheter per region": columns per quarter (Q2-26), metric rows per region. */
function parsePerRegion(wb: XLSX.WorkBook, year: number, quarter: number, acc: Acc) {
  const data = sheetRows(wb, "Fastigheter per region");
  if (!data) return;

  const yy = String(year).slice(-2);
  let headerIdx = -1;
  let colIdx = -1;
  for (let i = 0; i < Math.min(data.length, 15); i++) {
    const row = (data[i] ?? []).map(normalize);
    const idx = row.findIndex((c) => c === `q${quarter}-${yy}` || c === `q${quarter} ${yy}`);
    if (idx >= 0) {
      headerIdx = i;
      colIdx = idx;
      break;
    }
  }
  if (colIdx === -1) return;

  let currentRegion: string | null = null;
  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i] ?? [];
    // Leading empty columns are trimmed away, so scan the label cells
    // before the value column instead of assuming fixed positions.
    const labels: string[] = [];
    for (let c = 0; c < colIdx; c++) {
      const cell = String(row[c] ?? "").trim();
      if (cell) labels.push(cell);
    }
    for (const label of labels) {
      const region = canonicalRegion(label);
      if (region) currentRegion = region;
    }
    if (!currentRegion || currentRegion === "Totalt") continue;

    const value = parseNumber(row[colIdx]);
    if (value === null) continue;

    for (const label of labels) {
      const metric = normalize(label);
      if (metric.startsWith("hyresvärde")) put(acc, "hyresintakter", currentRegion, "actual", round2(value));
      else if (metric.startsWith("antal fastigheter")) put(acc, "antal_fastigheter", currentRegion, "actual", round2(value));
      else if (metric.startsWith("fastighetsvärde")) put(acc, "fastighetsvarde", currentRegion, "actual", round2(value * 1000));
    }
  }
}

/** "Optionsprogram": share price per quarter, stored on "Totalt". */
function parseOptions(wb: XLSX.WorkBook, quarter: number, acc: Acc) {
  const data = sheetRows(wb, "Optionsprogram");
  if (!data) return;

  let headerIdx = -1;
  let colIdx = -1;
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = (data[i] ?? []).map(normalize);
    const idx = row.findIndex((c) => c.includes("aktiekurs"));
    if (idx >= 0) {
      headerIdx = i;
      colIdx = idx;
      break;
    }
  }
  if (colIdx === -1) return;

  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i] ?? [];
    if (!row.some((c) => normalize(c) === `q${quarter}`)) continue;
    put(acc, "optioner", "Totalt", "actual", round2(parseNumber(row[colIdx])));
    break;
  }
}

function extractRows(wb: XLSX.WorkBook, year: number, quarter: number): ParsedRow[] {
  const acc: Acc = new Map();
  parseSummary(wb, quarter, acc);
  parsePerRegion(wb, year, quarter, acc);
  parseOptions(wb, quarter, acc);
  return [...acc.values()].filter((r) => r.budget !== null || r.actual !== null);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: hasPerm } = await supabase.rpc("has_module_slug_permission", { _user_id: user.id, _slug: "kpi", _permission: "edit" });
    const { data: hasAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!hasPerm && !hasAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const { storage_path, replace = true } = body;
    const year = Number(body.year);
    const quarter = Number(body.quarter);
    if (!storage_path || !year || !quarter) {
      return json({ error: "Missing storage_path, year or quarter" }, 400);
    }

    const { data: fileData, error: dlErr } = await supabase.storage.from("kpi-uploads").download(storage_path);
    if (dlErr || !fileData) {
      return json({ error: "Kunde inte hämta filen: " + (dlErr?.message ?? "okänt fel") }, 400);
    }

    const buf = new Uint8Array(await fileData.arrayBuffer());
    const wb = XLSX.read(buf, { type: "array" });
    const rows = extractRows(wb, year, quarter);

    if (!rows.length) {
      return json({
        error:
          `Hittade inga värden för Q${quarter} ${year} i filen. Kontrollera att fliken "Sammanställning" innehåller ett avsnitt för Q${quarter} med regionkolumner.`,
      }, 400);
    }

    const { data: regions } = await supabase.from("regions").select("id, name");
    const { data: kpiTypes } = await supabase.from("kpi_types").select("id, slug");
    const regionMap = new Map<string, string>((regions ?? []).map((r: any) => [normalize(r.name), r.id]));
    const kpiMap = new Map<string, string>((kpiTypes ?? []).map((k: any) => [k.slug, k.id]));

    if (replace) {
      await supabase.from("kpi_data").delete().eq("year", year).eq("quarter", quarter);
    }

    const toInsert: any[] = [];
    const skipped: any[] = [];
    for (const r of rows) {
      const kpi_type_id = kpiMap.get(r.kpi_slug);
      if (!kpi_type_id) { skipped.push({ ...r, reason: "kpi-typ saknas" }); continue; }
      toInsert.push({
        year,
        quarter,
        region_id: regionMap.get(normalize(r.region)) ?? null,
        region_name: r.region,
        kpi_type_id,
        budget: r.budget,
        actual: r.actual,
        created_by: user.id,
      });
    }

    const { error: insErr } = await supabase.from("kpi_data").insert(toInsert);
    if (insErr) return json({ error: insErr.message }, 500);

    return json({ ok: true, inserted: toInsert.length, skipped: skipped.length, sample: toInsert.slice(0, 5) });
  } catch (e: any) {
    console.error("import-kpi-excel failed", e?.message ?? e);
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});
