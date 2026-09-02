import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface KpiType {
  id: string;
  slug: string;
  name: string;
  unit: string;
  format: string;
  sort_order: number;
  higher_is_better: boolean;
  budget_label?: string;
}

export interface KpiRow {
  id: string;
  year: number;
  quarter: number;
  region_id: string | null;
  region_name: string | null;
  kpi_type_id: string;
  budget: number | null;
  actual: number | null;
  stretch: number | null;
  notes: string | null;
}

export function useKpiTypes() {
  return useQuery({
    queryKey: ["kpi-types"],
    queryFn: async (): Promise<KpiType[]> => {
      const { data } = await supabase
        .from("kpi_types" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return (data as any) ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useKpiData(year: number, quarter: number) {
  return useQuery({
    queryKey: ["kpi-data", year, quarter],
    queryFn: async (): Promise<KpiRow[]> => {
      const { data } = await supabase
        .from("kpi_data" as any)
        .select("*")
        .eq("year", year)
        .eq("quarter", quarter);
      return (data as any) ?? [];
    },
    staleTime: 60 * 1000,
  });
}

/** Alla kvartal för ett år – används för YTD-vyn. */
export function useKpiYearData(year: number) {
  return useQuery({
    queryKey: ["kpi-data-year", year],
    queryFn: async (): Promise<KpiRow[]> => {
      const { data } = await supabase
        .from("kpi_data" as any)
        .select("*")
        .eq("year", year)
        .order("quarter");
      return (data as any) ?? [];
    },
    staleTime: 60 * 1000,
  });
}

/** KPI:er som ackumuleras över kvartal (flöden). Övriga är ögonblicksvärden. */
export const FLOW_KPI_SLUGS = ["driftnetto", "nettouthyrning", "antal_kontrakt"];


export function useKpiAvailablePeriods() {
  return useQuery({
    queryKey: ["kpi-periods"],
    queryFn: async () => {
      const { data } = await supabase
        .from("kpi_data" as any)
        .select("year, quarter")
        .order("year", { ascending: false })
        .order("quarter", { ascending: false });
      const seen = new Set<string>();
      const out: { year: number; quarter: number }[] = [];
      for (const r of (data as any) ?? []) {
        const k = `${r.year}-${r.quarter}`;
        if (!seen.has(k)) { seen.add(k); out.push({ year: r.year, quarter: r.quarter }); }
      }
      return out;
    },
    staleTime: 60 * 1000,
  });
}

export function formatKpiValue(v: number | null | undefined, format: string, unit: string): string {
  if (v === null || v === undefined) return "—";
  if (format === "percent") return `${v.toFixed(1).replace(".", ",")} %`;
  if (format === "currency_bn") return `${v.toFixed(2).replace(".", ",")} ${unit}`;
  if (format === "currency") {
    // For low-value currencies (per-share prices), show 2 decimals
    if (unit === "kr" && Math.abs(v) < 10000) {
      return `${v.toFixed(2).replace(".", ",")} ${unit}`;
    }
    // Mkr-belopp under 1 000 visas med en decimal
    if (Math.abs(v) < 1000) {
      return `${v.toFixed(1).replace(".", ",")} ${unit}`;
    }
    return `${Math.round(v).toLocaleString("sv-SE")} ${unit}`;
  }

  if (format === "count") {
    // Duration uses 1 decimal (e.g. "4,2 år"), other counts are integers
    if (unit === "år") return `${v.toFixed(1).replace(".", ",")} ${unit}`;
    return `${Math.round(v).toLocaleString("sv-SE")} ${unit}`;
  }
  return String(v);
}

// Optioner: lösenpris för aktien (används för att räkna procentuell utveckling)
export const OPTIONER_STRIKE_PRICE = 295;

export interface KpiSummary {
  slug: string;
  name: string;
  unit: string;
  format: string;
  higher_is_better: boolean;
  year: number;
  quarter: number;
  total: number | null;
  budgetTotal: number | null;
  prevTotal: number | null;
}

/**
 * Aggregerar KPI-utfall över regioner enligt Excel-definitioner:
 * - currency / currency_bn / count: SUM över regioner (matchar Excel "Totalt")
 * - percent: viktat snitt vägt mot Driftnetto-utfall per region om möjligt,
 *   annars enkelt snitt. Matchar Excel:s viktade snitt för Vakansgrad/Överskottsgrad.
 *
 * Hämtar data för senaste tillgängliga (year, quarter) som finns i kpi_data,
 * och jämför med samma kvartal föregående år.
 */
export function useKpiDashboardSummary() {
  return useQuery({
    queryKey: ["kpi-dashboard-summary"],
    queryFn: async (): Promise<KpiSummary[]> => {
      const [{ data: types }, { data: allData }] = await Promise.all([
        supabase.from("kpi_types" as any).select("*").eq("is_active", true).order("sort_order"),
        supabase.from("kpi_data" as any).select("*"),
      ]);

      // Dashboard visar exakt dessa 4 KPI:er (i ordning) från senaste kvartalet
      const DASHBOARD_SLUGS = ["driftnetto", "hyresintakter", "vakansgrad", "optioner"];
      const allTypes = ((types as any[]) ?? []) as KpiType[];
      const kpiTypes = DASHBOARD_SLUGS
        .map((slug) => allTypes.find((t) => t.slug === slug))
        .filter((t): t is KpiType => !!t);
      const rows = ((allData as any[]) ?? []) as KpiRow[];
      if (rows.length === 0 || kpiTypes.length === 0) return [];

      // Hitta senaste kvartal som har minst en utfallsrad
      const periodsWithActual = rows
        .filter((r) => r.actual !== null && r.actual !== undefined)
        .map((r) => ({ year: r.year, quarter: r.quarter }));
      if (periodsWithActual.length === 0) return [];
      const latest = periodsWithActual.reduce((acc, p) =>
        p.year > acc.year || (p.year === acc.year && p.quarter > acc.quarter) ? p : acc
      );

      // Vikter: Driftnetto-utfall per region används som vikt för procent-KPI:er
      const driftnettoType = allTypes.find((t) => t.slug === "driftnetto");
      const weightByRegion = new Map<string, number>();
      if (driftnettoType) {
        for (const r of rows) {
          if (r.kpi_type_id !== driftnettoType.id) continue;
          if (r.year !== latest.year || r.quarter !== latest.quarter) continue;
          const k = r.region_id ?? r.region_name ?? "_";
          if (r.actual !== null && r.actual !== undefined) weightByRegion.set(k, Math.abs(r.actual));
        }
      }

      const aggregate = (year: number, quarter: number, kpiType: KpiType, field: "actual" | "budget"): number | null => {
        const matching = rows.filter(
          (r) => r.year === year && r.quarter === quarter && r.kpi_type_id === kpiType.id
        );
        const valid = matching
          .map((r) => ({ key: r.region_id ?? r.region_name ?? "_", v: r[field] }))
          .filter((x): x is { key: string; v: number } => x.v !== null && x.v !== undefined);
        if (valid.length === 0) return null;

        if (kpiType.format === "percent") {
          // Viktat snitt om vikter finns, annars enkelt snitt
          let totalW = 0;
          let weightedSum = 0;
          for (const { key, v } of valid) {
            const w = weightByRegion.get(key) ?? 0;
            totalW += w;
            weightedSum += v * w;
          }
          if (totalW > 0) return weightedSum / totalW;
          return valid.reduce((a, b) => a + b.v, 0) / valid.length;
        }
        // currency, currency_bn, count → summa
        return valid.reduce((a, b) => a + b.v, 0);
      };

      return kpiTypes.map((t) => ({
        slug: t.slug,
        name: t.name,
        unit: t.unit,
        format: t.format,
        higher_is_better: t.higher_is_better,
        year: latest.year,
        quarter: latest.quarter,
        total: aggregate(latest.year, latest.quarter, t, "actual"),
        budgetTotal: aggregate(latest.year, latest.quarter, t, "budget"),
        prevTotal: aggregate(latest.year - 1, latest.quarter, t, "actual"),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}
