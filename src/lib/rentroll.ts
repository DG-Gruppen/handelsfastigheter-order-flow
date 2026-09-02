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

/** Alla hyresgästnamn och kedjor/butiksnamn kopplade till en fastighet (unika). */
const tenantIndex: Record<string, string[]> = (() => {
  const map: Record<string, Set<string>> = {};
  units.forEach((u) => {
    const set = (map[u.fb] ||= new Set<string>());
    if (u.hg) set.add(u.hg);
    if (u.vn_butik) set.add(u.vn_butik);
  });
  Object.values(aggregates).forEach(() => {});
  Object.entries(aggregates).forEach(([fb, a]) => {
    const set = (map[fb] ||= new Set<string>());
    (a.butiker || []).forEach((b) => b && set.add(b));
  });
  const out: Record<string, string[]> = {};
  Object.entries(map).forEach(([k, v]) => (out[k] = Array.from(v).sort((a, b) => a.localeCompare(b, "sv"))));
  return out;
})();

export function tenantsFor(fastighet: string): string[] {
  return tenantIndex[fastighet] || [];
}

/** Bästa kända gatuadress för en fastighet (första objektet med gata). */
export function addressFor(fastighet: string): string | null {
  const u = unitsFor(fastighet).find((x) => x.gata);
  if (!u) return null;
  return [u.gata, [u.post, u.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

/** Google Maps-länk: adress om den finns, annars koordinater. */
export function googleMapsUrl(fastighet: string, lat?: number, lng?: number): string {
  const addr = addressFor(fastighet);
  const q = addr ? `${addr}` : lat != null && lng != null ? `${lat},${lng}` : fastighet;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
