import unitsData from "@/data/rent-roll-units.json";
import aggData from "@/data/rent-roll-agg.json";

export interface Unit {
  fb: string;
  omr: string | null;
  agare: string | null;
  forv: string | null;
  tf: string | null;
  obj: string | null;
  typ: string | null;
  grp: string | null;
  hg: string | null;
  vak: string | null;
  from: string | null;
  to: string | null;
  ups_hv: string | null;
  ups_hg: string | null;
  gata: string | null;
  post: string | null;
  ort: string | null;
  area: number | null;
  hyra: number | null;
  vh: number | null;
  krm2: number | null;
  hvp: number | null;
  hvk: number | null;
  vn_typ: string | null;
  vn_butik: string | null;
}

export interface Aggregate {
  area: number;
  hyra: number;
  vh: number;
  hvp: number;
  objekt: number;
  vakanta: number;
  antal_hg: number;
  agare: string | null;
  omr: string | null;
  forv: string | null;
  tf: string | null;
  butiker: string[];
}

export const units = unitsData as Unit[];
export const aggregates = aggData as Record<string, Aggregate>;

export function fmtKr(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "–";
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(Math.round(n)) + " kr";
}
export function fmtNum(n: number | null | undefined, unit = ""): string {
  if (n == null || isNaN(n)) return "–";
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(Math.round(n)) + (unit ? " " + unit : "");
}
export function fmtDate(iso: string | null): string {
  if (!iso) return "–";
  return iso;
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (isNaN(d)) return null;
  return Math.round((d - Date.now()) / 86400000);
}

export function getAgg(fastighet: string): Aggregate | undefined {
  return aggregates[fastighet];
}

export function unitsFor(fastighet: string): Unit[] {
  return units.filter((u) => u.fb === fastighet);
}
