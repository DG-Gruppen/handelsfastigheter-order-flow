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
  if (format === "currency") return `${Math.round(v).toLocaleString("sv-SE")} ${unit}`;
  if (format === "count") return `${Math.round(v).toLocaleString("sv-SE")} ${unit}`;
  return String(v);
}

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
 * Aggregates KPI actuals across regions for the latest available period and compares
 * to the same quarter previous year. Used by the dashboard top cards.
 */
export function useKpiDashboardSummary() {
  return useQuery({
    queryKey: ["kpi-dashboard-summary"],
    queryFn: async (): Promise<KpiSummary[]> => {
      const [{ data: types }, { data: allData }] = await Promise.all([
        supabase.from("kpi_types" as any).select("*").eq("is_active", true).order("sort_order"),
        supabase.from("kpi_data" as any).select("*"),
      ]);

      const kpiTypes = ((types as any[]) ?? []) as KpiType[];
      const rows = ((allData as any[]) ?? []) as KpiRow[];
      if (rows.length === 0) return [];

      const latest = rows.reduce((acc, r) => {
        if (!acc) return r;
        if (r.year > acc.year || (r.year === acc.year && r.quarter > acc.quarter)) return r;
        return acc;
      }, null as KpiRow | null)!;

      const sumFor = (year: number, quarter: number, kpiTypeId: string, field: "actual" | "budget") => {
        const vals = rows
          .filter((r) => r.year === year && r.quarter === quarter && r.kpi_type_id === kpiTypeId)
          .map((r) => r[field])
          .filter((v): v is number => v !== null && v !== undefined);
        if (vals.length === 0) return null;
        const t = kpiTypes.find((k) => k.id === kpiTypeId);
        if (t?.format === "percent") return vals.reduce((a, b) => a + b, 0) / vals.length;
        return vals.reduce((a, b) => a + b, 0);
      };

      return kpiTypes.map((t) => ({
        slug: t.slug,
        name: t.name,
        unit: t.unit,
        format: t.format,
        higher_is_better: t.higher_is_better,
        year: latest.year,
        quarter: latest.quarter,
        total: sumFor(latest.year, latest.quarter, t.id, "actual"),
        budgetTotal: sumFor(latest.year, latest.quarter, t.id, "budget"),
        prevTotal: sumFor(latest.year - 1, latest.quarter, t.id, "actual"),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}
