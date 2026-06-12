// Pure calculation engine ported from public/lcc-kalkylator.html
// All functions are pure — no DOM access. UI binds inputs/outputs.
import {
  ATGARDER, FASTIGHETER_RAW, PEF_BARARE, BARARE_LABEL,
  EPBD_TROSKEL_2030, EPBD_TROSKEL_2033,
  type Atgard, type Fastighet,
} from "./data";

export { ATGARDER, FASTIGHETER_RAW, PEF_BARARE, BARARE_LABEL, EPBD_TROSKEL_2030, EPBD_TROSKEL_2033 };
export type { Atgard, Fastighet };

export const DEFAULT_PRIS: Record<string, number> = { el: 1.8, fjv: 0.95, olja: 1.6, pellets: 0.7, fjk: 0.8 };

export type Priser = { el: number; fjv: number; olja: number; pellets: number; fjk: number };

export function defaultPriser(): Priser {
  return { ...DEFAULT_PRIS } as Priser;
}

export function getPris(barare: string, priser: Priser): number {
  const map: Record<string, keyof Priser> = { el: "el", fjv: "fjv", olja: "olja", pellets: "olja", fjk: "fjv" };
  const key = map[barare] || "el";
  return priser[key] ?? DEFAULT_PRIS[barare] ?? 1.8;
}

export function resolveBarare(bar: string | undefined, f: Fastighet | null | undefined): string {
  if (!bar) return "el";
  if (bar === "varme") {
    if (!f || f.nr === "VALFRI") return "el";
    const fjv = f.varme_fjv || 0, el = f.varme_el || 0, olja = f.varme_olja || 0;
    if (fjv >= el && fjv >= olja && fjv > 0) return "fjv";
    if (olja > el && olja > 0) return "olja";
    return "el";
  }
  if (bar === "tvv") {
    if (!f || f.nr === "VALFRI") return "el";
    const fjv = f.tvv_fjv || 0, el = f.tvv_el || 0, olja = f.tvv_olja || 0;
    if (fjv >= el && fjv >= olja && fjv > 0) return "fjv";
    if (olja > el && olja > 0) return "olja";
    return "el";
  }
  if (bar === "mix") return "mix";
  return bar;
}

export function mixFaktorer(f: Fastighet | null | undefined, priser: Priser) {
  if (!f || f.nr === "VALFRI") return { pef: 1.8, pris: getPris("el", priser) };
  const fjv = (f.varme_fjv || 0) + (f.tvv_fjv || 0);
  const el = (f.varme_el || 0) + (f.tvv_el || 0) + (f.kyla_el || 0) + (f.fastighetsel || 0);
  const olja = (f.varme_olja || 0) + (f.tvv_olja || 0);
  const fjk = f.kyla_fjk || 0;
  const tot = fjv + el + olja + fjk;
  if (tot <= 0) return { pef: 1.8, pris: getPris("el", priser) };
  const pef = (fjv * 0.7 + el * 1.8 + olja * 1.8 + fjk * 0.6) / tot;
  const pris = (fjv * getPris("fjv", priser) + el * getPris("el", priser) + olja * getPris("olja", priser) + fjk * getPris("fjk", priser)) / tot;
  return { pef, pris };
}

export type BararFaktorer = { pef_bef: number; pef_ny: number; pris_bef: number; pris_ny: number; bar_bef: string; bar_ny: string };

export function getBararFaktorer(
  a: Atgard | null,
  f: Fastighet | null | undefined,
  priser: Priser,
  overrideBef: string = "auto",
  overrideNy: string = "auto",
): BararFaktorer {
  const bb = overrideBef !== "auto" ? overrideBef : resolveBarare(a ? a.bar_bef : "el", f);
  const bn = overrideNy !== "auto" ? overrideNy : resolveBarare(a ? a.bar_ny : "el", f);
  let pef_bef: number, pris_bef: number, pef_ny: number, pris_ny: number;
  if (bb === "mix") { const m = mixFaktorer(f, priser); pef_bef = m.pef; pris_bef = m.pris; }
  else { pef_bef = PEF_BARARE[bb] || 1.8; pris_bef = getPris(bb, priser); }
  if (bn === "mix") { const m = mixFaktorer(f, priser); pef_ny = m.pef; pris_ny = m.pris; }
  else { pef_ny = PEF_BARARE[bn] || 1.8; pris_ny = getPris(bn, priser); }
  return { pef_bef, pef_ny, pris_bef, pris_ny, bar_bef: bb, bar_ny: bn };
}

export type Relevans = "rek" | "ok" | "nej";

export function atgardRelevans(a: Atgard, f: Fastighet | null | undefined): Relevans {
  if (!f || f.nr === "VALFRI") return "ok";
  const n = a.namn || "";
  const harEl = (f.varme_el || 0) > 0;
  const harFjv = (f.varme_fjv || 0) > 0;
  const harOlja = (f.varme_olja || 0) > 0;
  const harKylaEl = (f.kyla_el || 0) > 0;
  const harTvv = ((f.tvv_fjv || 0) + (f.tvv_el || 0) + (f.tvv_olja || 0)) > 0;
  const harVarme = harEl || harFjv || harOlja;
  const harFel = (f.fastighetsel || 0) > 0;
  if (/Elpanna → BV|Ersätt elpanna med VÅV|^VP - Värmepump luft\/vatten/.test(n)) return harEl ? "rek" : "nej";
  if (/Oljepanna → BV|Pelletspanna ersätter oljepanna/.test(n)) return harOlja ? "rek" : "nej";
  if (/Fjärrvärme → Bergvärme|Fjärrvärme → CO₂/.test(n)) return harFjv ? "rek" : "nej";
  if (/^BV - Bergvärmepump \(generisk\)/.test(n)) return harVarme ? "ok" : "nej";
  if (/^FÖNSTER|^ISOL|^TAK|^TÄT|^PORT|^LUFTRIDÅ|^KLIMAT|Frånluftsvärmepump|FTX/.test(n)) return harVarme ? "rek" : "nej";
  if (/Solfångare|Hetgasväxlare/.test(n)) return harTvv ? "rek" : "nej";
  if (/^SOL - Solfilm/.test(n)) return harKylaEl ? "rek" : "nej";
  if (/^LED|^PV - Solcellsanläggning|EC-fläktar|^PUMP|VAV/.test(n)) return harFel ? "rek" : "nej";
  if (/^STYR/.test(n)) return (harVarme || harFel) ? "rek" : "nej";
  return "ok";
}

export type AutoParams = { p1?: number; p2?: number; p3?: number; p4?: number } | null;

export function getAutoParams(atgard: Atgard, fastighet: Fastighet | null | undefined): AutoParams {
  if (!fastighet || fastighet.nr === "VALFRI") return null;
  const n = atgard.namn || "";
  const f = fastighet;
  const vbef = (f.varme_fjv || 0) + (f.varme_el || 0) + (f.varme_olja || 0);
  const tvv_bef = (f.tvv_fjv || 0) + (f.tvv_el || 0) + (f.tvv_olja || 0);

  if (n === "BV - Elpanna → BV + frikyla") {
    if ((f.varme_el || 0) <= 0) return null;
    const scop = f.reg === "Nord" ? 3.5 : f.reg === "Syd" ? 4.0 : 3.8;
    return { p1: f.varme_el!, p2: Math.round(f.varme_el! / scop) };
  }
  if (n === "BV - Oljepanna → BV (endast värme)") {
    if ((f.varme_olja || 0) <= 0) return null;
    const scop = f.reg === "Nord" ? 3.5 : f.reg === "Syd" ? 4.0 : 3.8;
    return { p1: f.varme_olja!, p2: Math.round(f.varme_olja! / scop) };
  }
  if (n === "BV - Oljepanna → BV + frikyla") {
    if ((f.varme_olja || 0) <= 0) return null;
    const scop = f.reg === "Nord" ? 3.5 : f.reg === "Syd" ? 4.0 : 3.8;
    return { p1: f.varme_olja!, p2: Math.round(f.varme_olja! / scop) };
  }
  if (n === "BV - Bergvärmepump (generisk)") {
    if (vbef <= 0) return null;
    const scop_ny = f.reg === "Nord" ? 3.5 : f.reg === "Syd" ? 4.0 : 3.8;
    return { p1: vbef, p2: atgard.p2, p3: scop_ny };
  }
  if (n === "BV - Fjärrvärme → Bergvärme") {
    if ((f.varme_fjv || 0) <= 0) return null;
    const scop = f.reg === "Nord" ? 3.5 : f.reg === "Syd" ? 4.0 : 3.8;
    return { p1: f.varme_fjv!, p2: Math.round(f.varme_fjv! / scop) };
  }
  if (n === "VÅV - Ersätt elpanna med VÅV (CO₂-kyla)") {
    if ((f.varme_el || 0) <= 0) return null;
    const tackning = f.reg === "Nord" ? 0.80 : f.reg === "Syd" ? 0.92 : 0.88;
    return { p1: f.varme_el!, p2: Math.round(f.varme_el! * (1 - tackning)) };
  }
  if (n === "VÅV - Fjärrvärme → CO₂-värmeåtervinning") {
    if ((f.varme_fjv || 0) <= 0) return null;
    const tackning = f.reg === "Nord" ? 0.65 : f.reg === "Syd" ? 0.80 : 0.75;
    return { p1: f.varme_fjv!, p2: Math.round(f.varme_fjv! * (1 - tackning)) };
  }
  if (n === "VP - Värmepump luft/vatten") {
    if ((f.varme_el || 0) <= 0) return null;
    return { p1: f.varme_el!, p2: atgard.p2, p3: atgard.p3 };
  }
  if (n === "VP - Pelletspanna ersätter oljepanna") {
    if ((f.varme_olja || 0) <= 0) return null;
    const eta_bef = atgard.p2 || 0.75;
    return { p1: Math.round(f.varme_olja! / eta_bef), p2: atgard.p2, p3: atgard.p3 };
  }
  if (n === "PV - Solcellsanläggning") {
    if ((f.fastighetsel || 0) <= 0) return null;
    const spec = f.reg === "Nord" ? 850 : f.reg === "Syd" ? 1050 : 950;
    return { p1: f.fastighetsel!, p4: spec };
  }
  if (n === "PV - Solfångare (varmvatten)") {
    const tvv = (f.tvv_el || 0) > 0 ? f.tvv_el! : ((f.tvv_fjv || 0) > 0 ? f.tvv_fjv! : 0);
    if (tvv <= 0) return null;
    return { p1: tvv, p2: Math.round(tvv * 0.50) };
  }
  if (/^STYR/.test(n) && !/Nattsänkning/.test(n)) {
    if (vbef + (f.fastighetsel || 0) <= 0) return null;
    const totalBef = vbef + (f.fastighetsel || 0);
    return { p1: totalBef, p2: Math.round(totalBef * 0.85) };
  }
  if (/^LED/.test(n)) {
    if ((f.fastighetsel || 0) <= 0) return null;
    const drifttid = atgard.p3 || 5840;
    const andel_belysning = 0.40;
    const p1_kW = Math.round((f.fastighetsel! * andel_belysning / drifttid) * 10) / 10;
    const reduktion = (n.includes("Närvaro") || n.includes("närvaro")) ? 0.233 : 0.292;
    const p2_kW = Math.round(p1_kW * reduktion * 10) / 10;
    return { p1: p1_kW, p2: p2_kW };
  }
  if (/^PUMP/.test(n)) return null;
  if (n === "VENT - Byte AC-fläktar → EC-fläktar (retrofit)") {
    if (!f.atemp || f.atemp <= 0) return null;
    const luftflode = Math.round(f.atemp * 0.5 / 100) / 10;
    return { p1: 1.5, p2: 0.5, p3: luftflode, p4: 5840 };
  }
  if (/^BRAND/.test(n)) return null;
  const gradtim = f.reg === "Nord" ? 110 : f.reg === "Syd" ? 82 : 96;
  if (/^TÄT/.test(n)) {
    if (vbef <= 0) return null;
    const andel = f.reg === "Nord" ? 0.06 : f.reg === "Syd" ? 0.04 : 0.05;
    return { p1: vbef, p2: Math.round(vbef * (1 - andel)) };
  }
  if (/^FÖNSTER/.test(n)) {
    if (!f.atemp || vbef <= 0) return null;
    const area = Math.max(30, Math.round(f.atemp * 0.05));
    return { p1: atgard.p1, p2: atgard.p2, p3: area, p4: gradtim };
  }
  if (n === "ISOL - Tilläggsisolering vindsbjälklag") {
    if (!f.atemp || vbef <= 0) return null;
    return { p1: atgard.p1, p2: atgard.p2, p3: Math.round(f.atemp * 0.85), p4: gradtim };
  }
  if (n === "ISOL - Tilläggsisolering yttervägg") {
    if (!f.atemp || vbef <= 0) return null;
    const area = Math.round(4 * Math.sqrt(f.atemp) * 4.5 * 0.8);
    return { p1: atgard.p1, p2: atgard.p2, p3: area, p4: gradtim };
  }
  if (/^TAK/.test(n)) {
    if (!f.atemp || vbef <= 0) return null;
    return { p1: atgard.p1, p2: atgard.p2, p3: Math.round(f.atemp * 0.9), p4: gradtim };
  }
  if (/^LUFTRIDÅ/.test(n)) {
    if (!f.atemp || vbef <= 0) return null;
    const spec = f.reg === "Nord" ? 5 : f.reg === "Syd" ? 3 : 4;
    const bef = Math.min(Math.round(f.atemp * spec), Math.round(vbef * 0.15));
    return { p1: bef, p2: Math.round(bef * 0.45) };
  }
  if (/Hetgasväxlare/.test(n)) {
    if (tvv_bef <= 0) return null;
    return { p1: tvv_bef, p2: Math.round(tvv_bef * 0.25) };
  }
  if (/^KLIMAT/.test(n)) {
    if (vbef <= 0) return null;
    const andel = f.reg === "Nord" ? 0.15 : 0.12;
    return { p1: vbef, p2: Math.round(vbef * (1 - andel)) };
  }
  if (/Nattsänkning/.test(n)) {
    const tot = vbef + tvv_bef + (f.fastighetsel || 0);
    if (tot <= 0) return null;
    return { p1: tot, p2: Math.round(tot * 0.93) };
  }
  if (/^SOL - Solfilm/.test(n)) {
    if ((f.kyla_el || 0) <= 0) return null;
    return { p1: f.kyla_el!, p2: Math.round(f.kyla_el! * 0.75) };
  }
  if (n === "VENT - Byte ventilation till FTX (med VVX)") {
    if (!f.atemp || vbef <= 0) return null;
    const drift = atgard.p3 || 5840;
    const bespar_kwh = Math.min(f.atemp * 18, vbef * 0.45);
    const p1k = Math.round(((bespar_kwh / drift) + 5.5) * 10) / 10;
    return { p1: p1k, p2: 5.5, p3: drift };
  }
  if (n === "VENT - Behovsstyrd ventilation (VAV)") {
    if (!f.atemp || (f.fastighetsel || 0) <= 0) return null;
    const p1k = Math.round(f.atemp * 0.002 * 10) / 10;
    return { p1: p1k, p2: Math.round(p1k * 0.55 * 10) / 10, p3: atgard.p3 || 5840 };
  }
  if (n === "VENT - Frånluftsvärmepump (FVP)") {
    if (vbef <= 0) return null;
    const tackt = vbef * 0.60;
    const p1k = Math.round((tackt / 8760) * 10) / 10;
    const p2k = Math.round((tackt / 2.5 / 8760) * 10) / 10;
    return { p1: p1k, p2: p2k, p3: 8760 };
  }
  if (n === "PORT - Byte av automatik port/dörr") {
    if (vbef <= 0) return null;
    const bef = Math.min(18000, Math.round(vbef * 0.05));
    return { p1: bef, p2: Math.round(bef * 0.5) };
  }
  if (n === "PORT - Byte av entré-automatik") {
    if (vbef <= 0) return null;
    const bef = Math.min(8000, Math.round(vbef * 0.03));
    return { p1: bef, p2: Math.round(bef * 0.5) };
  }
  return null;
}

export function getVarmeKalla(f: Fastighet): string {
  const parts: string[] = [];
  const harFjv = (f.varme_fjv || 0) > 0;
  const harEl = (f.varme_el || 0) > 0;
  const harOlja = (f.varme_olja || 0) > 0;
  const varmeDelar: string[] = [];
  if (harFjv) varmeDelar.push("Fjärrvärme");
  if (harOlja) varmeDelar.push("Oljepanna");
  if (harEl) varmeDelar.push("Elpanna");
  if (varmeDelar.length) parts.push(varmeDelar.join(" + "));
  const tvvFjv = (f.tvv_fjv || 0) > 0;
  const tvvEl = (f.tvv_el || 0) > 0;
  const tvvOlja = (f.tvv_olja || 0) > 0;
  if (tvvFjv && !harFjv) parts.push("TVV: fjärrvärme");
  if (tvvOlja && !harOlja) parts.push("TVV: olja");
  if (tvvEl && !harEl) parts.push("TVV: el");
  if ((f.kyla_fjk || 0) > 0 && (f.kyla_el || 0) > 0) parts.push("Fjärrkyla + Kyl-el");
  else if ((f.kyla_fjk || 0) > 0) parts.push("Fjärrkyla");
  else if ((f.kyla_el || 0) > 0) parts.push("Kyl-el");
  return parts.length ? parts.join(" · ") : "—";
}

export function getScaledInvest(atgard: Atgard, fastighet: Fastighet | null | undefined, kWpOverride?: number): number {
  if (atgard.invest_kr_kWp) {
    const kWp = kWpOverride ?? atgard.p3 ?? 100;
    return Math.round(kWp * atgard.invest_kr_kWp);
  }
  const fix = atgard.invest_fix !== undefined ? atgard.invest_fix : atgard.invest;
  const kr_m2 = atgard.invest_kr_m2 || 0;
  const atemp = fastighet && (fastighet.atemp || 0) > 0 ? fastighet.atemp! : null;
  if (atemp && kr_m2 > 0) return fix + kr_m2 * atemp;
  return atgard.invest;
}

export type CalcInputs = {
  p1: number; p2: number; p3: number; p4: number;
  invest: number; restvarde: number;
  livslangd: number; ranta: number; // ranta as percent
  uh_bef: number; uh_ny: number;
};

export type CalcResult = {
  energi_bef: number; energi_ny: number;
  energibesparing: number;
  energikostn_bef: number; energikostn_ny: number;
  kostbesparing: number;
  payback: number;
  lcc_bef: number; lcc_ny: number;
  npv: number;
  co2_ar: number; // ton/year
  bf: BararFaktorer;
  cf: CashflowPoint[];
};

export type CashflowPoint = { ar: number; kum: number; nv: number };

export function buildCFData(ekb: number, ekn: number, uhb: number, uhn: number, invest: number, N: number, r: number, rv: number): CashflowPoint[] {
  const data: CashflowPoint[] = [];
  let kum = -invest;
  data.push({ ar: 0, kum: -invest, nv: -invest });
  for (let t = 1; t <= N; t++) {
    const netto = (ekb - ekn) + (uhb - uhn);
    const nv = r === 0 ? netto : netto / Math.pow(1 + r, t);
    kum += nv;
    if (t === N) kum += rv / Math.pow(1 + r, N);
    data.push({ ar: t, kum, nv });
  }
  return data;
}

export function berakna(a: Atgard, inp: CalcInputs, f: Fastighet | null | undefined, priser: Priser, ovBef = "auto", ovNy = "auto"): CalcResult {
  const { p1, p2, p3, p4, invest, restvarde, livslangd: N, uh_bef, uh_ny } = inp;
  const r = (inp.ranta || 0) / 100;
  let energi_bef = p1, energi_ny = p2;
  if (a.typ === "kW") { energi_bef = p1 * p3; energi_ny = p2 * p3; }
  else if (a.typ === "Verkningsgrad") {
    energi_bef = p2 !== 0 ? p1 / p2 : p1;
    energi_ny = p3 !== 0 ? p1 / p3 : 0;
  } else if (a.typ === "U-varde") { energi_bef = p1 * p3 * p4; energi_ny = p2 * p3 * p4; }
  else if (a.typ === "kWh_PV") {
    const pv_prod = p3 * p4 * 0.85;
    energi_bef = p1;
    energi_ny = Math.max(0, p1 - pv_prod);
  } else if (a.typ === "SFP") { energi_bef = p1 * p3 * p4; energi_ny = p2 * p3 * p4; }

  const bf = getBararFaktorer(a, f, priser, ovBef, ovNy);
  const energibesparing = Math.max(0, energi_bef - energi_ny);
  const energikostn_bef = energi_bef * bf.pris_bef;
  const energikostn_ny = energi_ny * bf.pris_ny;
  const kostbesparing = (energikostn_bef - energikostn_ny) + (uh_bef - uh_ny);
  const payback = kostbesparing > 0 ? invest / kostbesparing : Infinity;

  let annuitet: number;
  if (r === 0) annuitet = N;
  else annuitet = (1 - Math.pow(1 + r, -N)) / r;
  const restvarde_pv = restvarde / Math.pow(1 + r, N);
  const lcc_bef = (energikostn_bef + uh_bef) * annuitet;
  const lcc_ny = invest + (energikostn_ny + uh_ny) * annuitet - restvarde_pv;
  const npv = (kostbesparing * annuitet) - invest + restvarde_pv;
  const co2_ar = energibesparing * 0.04 / 1000;
  const cf = buildCFData(energikostn_bef, energikostn_ny, uh_bef, uh_ny, invest, N, r, restvarde);
  return { energi_bef, energi_ny, energibesparing, energikostn_bef, energikostn_ny, kostbesparing, payback, lcc_bef, lcc_ny, npv, co2_ar, bf, cf };
}

export function petToKlassSpann(petBefore: number, petAfter: number, klassBefore: string | null, gv: number | null) {
  if (!klassBefore || !petBefore) return null;
  const klasser = ["A", "B", "C", "D", "E", "F", "G"];
  if (gv && gv > 0) {
    const k = petAfter / gv;
    let mid: string;
    if (k < 0.38) mid = "A";
    else if (k < 0.56) mid = "B";
    else if (k < 0.75) mid = "C";
    else if (k < 1.13) mid = "D";
    else if (k < 1.50) mid = "E";
    else if (k < 2.25) mid = "F";
    else mid = "G";
    const edIdx = klasser.indexOf(klassBefore);
    let midIdx = klasser.indexOf(mid);
    midIdx = Math.min(midIdx, edIdx);
    const low = klasser[Math.max(0, midIdx - 1)];
    const high = klasser[Math.min(edIdx, midIdx + 1)];
    return { low, mid: klasser[midIdx], high, exact: low === high };
  }
  const pct = petBefore > 0 ? ((petBefore - petAfter) / petBefore) * 100 : 0;
  const idxB = klasser.indexOf(klassBefore);
  const steg = pct >= 50 ? 4 : pct >= 35 ? 3 : pct >= 20 ? 2 : pct >= 10 ? 1 : 0;
  const midIdx = Math.max(0, idxB - steg);
  const low = klasser[Math.max(0, midIdx - 1)];
  const high = klasser[Math.min(6, midIdx + 1)];
  return { low, mid: klasser[midIdx], high, exact: false };
}

export type EPBDResult = {
  klassBefore: string | null;
  petBefore: number | null;
  petAfter: number | null;
  petReduktion: number;
  petPct: number;
  spann: ReturnType<typeof petToKlassSpann>;
  loser2030: boolean;
  loser2033: boolean;
  kraver2030: boolean;
  kraver2033: boolean;
};

export function computeEPBD(f: Fastighet | null | undefined, energi_bef: number, energi_ny: number, pef_bef: number, pef_ny: number): EPBDResult | null {
  if (!f) return null;
  const klassBefore = f.klass;
  const petBefore = f.pet;
  const atemp = f.atemp;
  let petAfter: number | null = null, spann: ReturnType<typeof petToKlassSpann> = null, petReduktion = 0, petPct = 0;
  if (petBefore && atemp) {
    const abs = Math.max(0, (energi_bef * (pef_bef || 1.8) - energi_ny * (pef_ny || 1.8)) / atemp);
    petAfter = Math.max(0, petBefore - abs);
    petReduktion = abs;
    petPct = petBefore > 0 ? (abs / petBefore) * 100 : 0;
    spann = petToKlassSpann(petBefore, petAfter, klassBefore, f.gv);
  }
  return {
    klassBefore, petBefore, petAfter, petReduktion, petPct, spann,
    loser2030: petAfter !== null && petAfter <= EPBD_TROSKEL_2030,
    loser2033: petAfter !== null && petAfter <= EPBD_TROSKEL_2033,
    kraver2030: f.e30 === "JA",
    kraver2033: f.e33 === "JA",
  };
}

export const fmtKr = (n: number) => isFinite(n) ? Math.round(n).toLocaleString("sv") : "—";
export const fmtNum = (n: number) => isFinite(n) ? Math.round(n).toLocaleString("sv") : "—";
