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
  stretch: number | null;
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

/** "Nord" -> "Region Nord", "Total" -> "Totalt", "Afu + elimineringar" -> "Afu + Elimineringar" */
function canonicalRegion(raw: string): string | null {
  const n = normalize(raw);
  if (!n) return null;
  if (n.startsWith("afu")) return "Afu + Elimineringar";
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
  field: "budget" | "actual" | "stretch",
  value: number | null,
) {
  if (value === null) return;
  const key = `${slug}|${region}`;
  const existing = acc.get(key) ?? { region, kpi_slug: slug, budget: null, actual: null, stretch: null };
  if (existing[field] === null) existing[field] = value;
  acc.set(key, existing);
}

function sheetRows(wb: XLSX.WorkBook, name: string): any[][] | null {
  const match = wb.SheetNames.find((s) => normalize(s) === normalize(name));
  if (!match) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[match], { header: 1, defval: null }) as any[][];
}

// ---------------------------------------------------------------------------
// "Budget och Utfall": tre kolumnblock (Mål | Utfall | Varians) separerade av
// tomma kolumner. Varje sektion har fyra kvartalsrader följt av en summarad.
// ---------------------------------------------------------------------------

type BlockCols = { budget: Record<string, number>; actual: Record<string, number> };

/** Delar upp rubrikraden i block via tomma kolumner och mappar regioner. */
function headerBlocks(header: any[]): BlockCols | null {
  const groups: { start: number; cols: { idx: number; label: string }[] }[] = [];
  let current: { start: number; cols: { idx: number; label: string }[] } | null = null;
  for (let j = 1; j < header.length + 1; j++) {
    const label = String(header[j] ?? "").trim();
    if (label) {
      if (!current) { current = { start: j, cols: [] }; groups.push(current); }
      current.cols.push({ idx: j, label });
    } else if (current && j > current.start) {
      current = null;
    }
  }
  const usable = groups.filter((g) => g.cols.some((c) => canonicalRegion(c.label)));
  if (usable.length < 2) return null;

  const mapGroup = (g: typeof groups[number]) => {
    const out: Record<string, number> = {};
    for (const { idx, label } of g.cols) {
      const n = normalize(label);
      let region: string | null = null;
      if (n === "nord total" || n === "nord\ntotal") region = "Region Nord";
      else if (n === "mitt total") region = "Region Mitt";
      else if (n === "syd total") region = "Region Syd";
      else if (n.startsWith("afu +")) region = "Afu + Elimineringar";
      else if (n === "totalt") region = "Totalt";
      if (region && out[region] === undefined) out[region] = idx;
    }
    return out;
  };

  return { budget: mapGroup(usable[0]), actual: mapGroup(usable[1]) };
}

/** Hittar rubrikraden ovanför en sektion (raden med "Nord Total"-kolumner). */
function findHeaderAbove(data: any[][], rowIdx: number): BlockCols | null {
  for (let i = rowIdx; i >= 0; i--) {
    const row = data[i] ?? [];
    const hits = row.filter((c) => /nord/i.test(String(c ?? ""))).length;
    if (hits >= 2) return headerBlocks(row);
  }
  return null;
}

/** Returnerar raden för angivet kvartal bland de fyra raderna ovanför en summarad. */
function quarterRowAbove(data: any[][], summaryIdx: number, quarter: number): any[] | null {
  for (let i = summaryIdx - 1; i >= Math.max(0, summaryIdx - 6); i--) {
    const label = normalize((data[i] ?? [])[1]);
    if (label === `q${quarter}`) return data[i];
  }
  return null;
}

function findRow(data: any[][], test: (label: string) => boolean): number {
  for (let i = 0; i < data.length; i++) {
    if (test(normalize((data[i] ?? [])[1]))) return i;
  }
  return -1;
}

function parseBudgetOchUtfall(wb: XLSX.WorkBook, quarter: number, acc: Acc) {
  const data = sheetRows(wb, "Budget och Utfall");
  if (!data) return;

  const sections: { slug: string; budgetTest: (l: string) => boolean; stretchTest: (l: string) => boolean; factor: number }[] = [
    {
      slug: "driftnetto",
      budgetTest: (l) => l.startsWith("budget (driftnetto"),
      stretchTest: (l) => l.startsWith("stretch (driftnetto"),
      factor: 1,
    },
    {
      slug: "overskottsgrad",
      budgetTest: (l) => l.startsWith("budget: överskottsgrad"),
      stretchTest: (l) => l.startsWith("stretch: överskottsgrad"),
      factor: 100,
    },
  ];

  for (const s of sections) {
    const budgetIdx = findRow(data, s.budgetTest);
    if (budgetIdx === -1) continue;
    const cols = findHeaderAbove(data, budgetIdx);
    if (!cols) continue;

    const budgetRow = quarterRowAbove(data, budgetIdx, quarter);
    if (budgetRow) {
      for (const [region, idx] of Object.entries(cols.budget)) {
        put(acc, s.slug, region, "budget", round2(mul(parseNumber(budgetRow[idx]), s.factor)));
      }
      for (const [region, idx] of Object.entries(cols.actual)) {
        put(acc, s.slug, region, "actual", round2(mul(parseNumber(budgetRow[idx]), s.factor)));
      }
    }

    const stretchIdx = findRow(data, s.stretchTest);
    const stretchRow = stretchIdx === -1 ? null : quarterRowAbove(data, stretchIdx, quarter);
    if (stretchRow) {
      for (const [region, idx] of Object.entries(cols.budget)) {
        put(acc, s.slug, region, "stretch", round2(mul(parseNumber(stretchRow[idx]), s.factor)));
      }
    }
  }

  // Mål för vakansgrad, t.ex. "<2%"
  const vakansIdx = findRow(data, (l) => l.startsWith("mål vakansgrad"));
  if (vakansIdx >= 0) {
    const target = parseNumber(
      (data[vakansIdx] ?? []).map((c) => String(c ?? "")).find((c) => /%/.test(c)) ?? null,
    );
    if (target !== null) {
      for (const region of ["Region Nord", "Region Mitt", "Region Syd", "Totalt"]) {
        put(acc, "vakansgrad", region, "budget", target);
      }
    }
  }
}

function mul(v: number | null, f: number): number | null {
  return v === null ? null : v * f;
}

// ---------------------------------------------------------------------------
// "Vakans & Duration": en rad per månad. Vi tar sista månaden i kvartalet.
// ---------------------------------------------------------------------------
function parseVakansDuration(wb: XLSX.WorkBook, year: number, quarter: number, acc: Acc) {
  const data = sheetRows(wb, "Vakans & Duration");
  if (!data) return;

  let headerIdx = -1;
  for (let i = 0; i < Math.min(data.length, 15); i++) {
    if ((data[i] ?? []).some((c) => normalize(c) === "datum")) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return;

  const header = data[headerIdx];
  // Kolumngrupper: "Duration ..." först, "Ekonomisk vakansgrad ..." sist
  const groupTitles = data[headerIdx - 1] ?? [];
  const durationStart = groupTitles.findIndex((c) => normalize(c).startsWith("duration"));
  const vakansStart = groupTitles.findIndex((c) => normalize(c).startsWith("ekonomisk vakansgrad"));

  const colsIn = (start: number, end: number) => {
    const out: Record<string, number> = {};
    for (let j = start; j < end; j++) {
      const region = canonicalRegion(String(header[j] ?? ""));
      if (region && out[region] === undefined) out[region] = j;
    }
    return out;
  };
  const durationCols = durationStart >= 0 ? colsIn(durationStart, durationStart + 6) : {};
  const vakansCols = vakansStart >= 0 ? colsIn(vakansStart, vakansStart + 6) : {};

  const endMonth = quarter * 3;
  let target: any[] | null = null;
  for (let i = headerIdx + 1; i < data.length; i++) {
    const raw = (data[i] ?? [])[1];
    if (!raw) continue;
    const d = raw instanceof Date ? raw : new Date(String(raw));
    if (isNaN(d.getTime())) continue;
    if (d.getFullYear() === year && d.getMonth() + 1 === endMonth) { target = data[i]; break; }
  }
  if (!target) return;

  for (const [region, idx] of Object.entries(durationCols)) {
    put(acc, "duration", region, "actual", round2(parseNumber(target[idx])));
  }
  for (const [region, idx] of Object.entries(vakansCols)) {
    put(acc, "vakansgrad", region, "actual", round2(mul(parseNumber(target[idx]), 100)));
  }
}

// ---------------------------------------------------------------------------
// "Fastigheter per region": kolumn per kvartal (Q1-26).
// ---------------------------------------------------------------------------
function parsePerRegion(wb: XLSX.WorkBook, year: number, quarter: number, acc: Acc) {
  const data = sheetRows(wb, "Fastigheter per region");
  if (!data) return;

  const yy = String(year).slice(-2);
  let headerIdx = -1;
  let colIdx = -1;
  for (let i = 0; i < Math.min(data.length, 15); i++) {
    const row = (data[i] ?? []).map(normalize);
    const idx = row.findIndex((c) => c === `q${quarter}-${yy}` || c === `q${quarter} ${yy}`);
    if (idx >= 0) { headerIdx = i; colIdx = idx; break; }
  }
  if (colIdx === -1) return;

  let currentRegion: string | null = null;
  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i] ?? [];
    const labels: string[] = [];
    for (let c = 0; c < colIdx; c++) {
      const cell = String(row[c] ?? "").trim();
      if (cell) labels.push(cell);
    }
    for (const label of labels) {
      const region = canonicalRegion(label);
      if (region) currentRegion = region;
    }
    if (!currentRegion) continue;

    const value = parseNumber(row[colIdx]);
    if (value === null) continue;

    for (const label of labels) {
      const metric = normalize(label);
      if (metric.startsWith("hyresvärde")) put(acc, "hyresintakter", currentRegion, "actual", round2(value));
      else if (metric.startsWith("antal fastigheter")) put(acc, "antal_fastigheter", currentRegion, "actual", round2(value));
      else if (metric.startsWith("fastighetsvärde")) put(acc, "fastighetsvarde", currentRegion, "actual", round2(value));
    }
  }
}

// ---------------------------------------------------------------------------
// "Nettouthyrning": två block – belopp i SEK och antal nytecknade kontrakt.
// ---------------------------------------------------------------------------
function parseNettouthyrning(wb: XLSX.WorkBook, quarter: number, acc: Acc) {
  const data = sheetRows(wb, "Nettouthyrning");
  if (!data) return;

  for (let i = 0; i < data.length; i++) {
    const row = data[i] ?? [];
    const first = normalize(row[1]);
    const isAmount = first === "sek";
    const isCount = first === "#";
    if (!isAmount && !isCount) continue;

    const cols: Record<string, number> = {};
    row.forEach((cell, j) => {
      const region = canonicalRegion(String(cell ?? ""));
      if (region && cols[region] === undefined) cols[region] = j;
    });

    for (let k = i + 1; k < Math.min(i + 8, data.length); k++) {
      const r = data[k] ?? [];
      if (normalize(r[1]) !== `q${quarter}`) continue;
      for (const [region, j] of Object.entries(cols)) {
        const v = parseNumber(r[j]);
        if (isAmount) put(acc, "nettouthyrning", region, "actual", round2(mul(v, 1 / 1_000_000)));
        else put(acc, "antal_kontrakt", region, "actual", v);
      }
      break;
    }
  }
}

/** "Optionsprogram": aktiekurs per kvartal, lagras på "Totalt". */
function parseOptions(wb: XLSX.WorkBook, quarter: number, acc: Acc) {
  const data = sheetRows(wb, "Optionsprogram");
  if (!data) return;

  let headerIdx = -1;
  let colIdx = -1;
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = (data[i] ?? []).map(normalize);
    const idx = row.findIndex((c) => c.includes("aktiekurs"));
    if (idx >= 0) { headerIdx = i; colIdx = idx; break; }
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
  parseBudgetOchUtfall(wb, quarter, acc);
  parseVakansDuration(wb, year, quarter, acc);
  parsePerRegion(wb, year, quarter, acc);
  parseNettouthyrning(wb, quarter, acc);
  parseOptions(wb, quarter, acc);
  return [...acc.values()].filter((r) => r.budget !== null || r.actual !== null || r.stretch !== null);
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
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const rows = extractRows(wb, year, quarter);

    if (!rows.length) {
      return json({
        error:
          `Hittade inga värden för Q${quarter} ${year} i filen. Kontrollera att flikarna "Budget och Utfall", "Vakans & Duration", "Fastigheter per region" och "Nettouthyrning" finns med.`,
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
        stretch: r.stretch,
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
