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
  return String(v);
}
