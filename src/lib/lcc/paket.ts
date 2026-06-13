// Paket-logik (Steg 6) — ren beräkning, ingen DOM.
// Ported from public/lcc-kalkylator.html (paketBerakna + renderPaketForslag).
import {
  ATGARDER, FASTIGHETER_RAW, PEF_BARARE,
  EPBD_TROSKEL_2030, EPBD_TROSKEL_2033,
  type Atgard, type Fastighet,
} from "./data";
import {
  atgardRelevans, getAutoParams, getPris, mixFaktorer, petToKlassSpann,
  resolveBarare, type Priser, defaultPriser,
} from "./calc";

/** En snapshot av en kalkyl i paketet (det vi behöver per åtgärd). */
export type PaketItem = {
  atgard: string;          // namn
  fastighet: string;       // vis
  energi_bef: number;
  energi_ny: number;
  kostbesparing: number;
  invest: number;
  livslangd: number;
  pef_bef: number;
  pef_ny: number;
};

/** Avgör vilken energipost en åtgärd "konsumerar" (för överlappsskydd). */
export function paketPoolKey(namn: string): string {
  if (/Elpanna|VP - Värmepump luft|VÅV - Ersätt elpanna/.test(namn)) return "varme_el";
  if (/Fjärrvärme → |VÅV - Fjärrvärme/.test(namn)) return "varme_fjv";
  if (/Oljepanna|Pelletspanna/.test(namn)) return "varme_olja";
  if (/^FÖNSTER|^ISOL|^TAK|^TÄT|^PORT|^LUFTRIDÅ|^KLIMAT|FTX|Frånluftsvärmepump|^BV - Bergvärmepump/.test(namn)) return "varme";
  if (/Solfångare|Hetgasväxlare/.test(namn)) return "tvv";
  if (/^SOL - Solfilm/.test(namn)) return "kyla_el";
  if (/^LED|^PV - Solcells|^PUMP|EC-fläktar|VAV|^BRAND/.test(namn)) return "fastighetsel";
  return "mix";
}

export type PaketRow = PaketItem & {
  skala: number;
  kwh_just: number;
  kr_just: number;
  petD_just: number;
};

export type PaketResult = {
  f: Fastighet;
  rows: PaketRow[];
  sumInvest: number;
  sumBesparKr: number;
  sumPetDelta: number;
  sumKwh: number;
  petAfter: number;
  payback: number;
  spann: ReturnType<typeof petToKlassSpann>;
  overlapp: boolean;
  maxLiv: number;
  klar30: boolean;
  klar33: boolean;
};

export function paketBerakna(paket: PaketItem[], fastighetVis: string | null): PaketResult | null {
  if (!fastighetVis || paket.length === 0) return null;
  const f = FASTIGHETER_RAW.find((x) => x.vis === fastighetVis);
  if (!f) return null;

  const pool = {
    varme_el: f.varme_el || 0,
    varme_fjv: f.varme_fjv || 0,
    varme_olja: f.varme_olja || 0,
    tvv: (f.tvv_fjv || 0) + (f.tvv_el || 0) + (f.tvv_olja || 0),
    kyla_el: f.kyla_el || 0,
    fastighetsel: f.fastighetsel || 0,
  };
  const heatTotal = pool.varme_el + pool.varme_fjv + pool.varme_olja;
  const grandTotal = heatTotal + pool.tvv + pool.kyla_el + pool.fastighetsel + (f.kyla_fjk || 0);

  const ansprak: Record<string, number> = {};
  paket.forEach((p) => {
    const key = paketPoolKey(p.atgard);
    ansprak[key] = (ansprak[key] || 0) + Math.max(0, p.energi_bef - p.energi_ny);
  });

  const skala: Record<string, number> = {};
  let overlapp = false;
  (["varme_el", "varme_fjv", "varme_olja", "tvv", "kyla_el", "fastighetsel"] as const).forEach((b) => {
    if (!ansprak[b]) { skala[b] = 1; return; }
    if (ansprak[b] > pool[b] && pool[b] >= 0) {
      skala[b] = pool[b] > 0 ? pool[b] / ansprak[b] : 0;
      overlapp = true;
    } else skala[b] = 1;
  });

  const heatClaimed =
    (ansprak.varme_el || 0) * skala.varme_el +
    (ansprak.varme_fjv || 0) * skala.varme_fjv +
    (ansprak.varme_olja || 0) * skala.varme_olja;
  const heatRest = Math.max(0, heatTotal - heatClaimed);
  if (ansprak.varme) {
    if (ansprak.varme > heatRest) { skala.varme = heatRest > 0 ? heatRest / ansprak.varme : 0; overlapp = true; }
    else skala.varme = 1;
  } else skala.varme = 1;

  const claimedSoFar =
    heatClaimed +
    (ansprak.varme || 0) * skala.varme +
    (ansprak.tvv || 0) * skala.tvv +
    (ansprak.kyla_el || 0) * skala.kyla_el +
    (ansprak.fastighetsel || 0) * skala.fastighetsel;
  const mixRest = Math.max(0, grandTotal - claimedSoFar);
  if (ansprak.mix) {
    if (ansprak.mix > mixRest) { skala.mix = mixRest > 0 ? mixRest / ansprak.mix : 0; overlapp = true; }
    else skala.mix = 1;
  } else skala.mix = 1;

  let sumInvest = 0, sumBesparKr = 0, sumPetDelta = 0, sumKwh = 0, maxLiv = 0;
  const rows: PaketRow[] = paket.map((p) => {
    const s = skala[paketPoolKey(p.atgard)] ?? 1;
    const eb = p.energi_bef;
    const en = p.energi_ny + (p.energi_bef - p.energi_ny) * (1 - s);
    const kwh = Math.max(0, eb - en);
    const petD = Math.max(0, eb * p.pef_bef - en * p.pef_ny) / (f.atemp || 1);
    const kr = p.kostbesparing * s;
    sumInvest += p.invest;
    sumBesparKr += kr;
    sumPetDelta += petD;
    sumKwh += kwh;
    maxLiv = Math.max(maxLiv, p.livslangd || 15);
    return { ...p, skala: s, kwh_just: kwh, petD_just: petD, kr_just: kr };
  });

  const petAfter = Math.max(0, (f.pet || 0) - sumPetDelta);
  const payback = sumBesparKr > 0 ? sumInvest / sumBesparKr : Infinity;
  const spann = petToKlassSpann(f.pet || 0, petAfter, f.klass, f.gv || null);
  return {
    f, rows, sumInvest, sumBesparKr, sumPetDelta, sumKwh, petAfter, payback, spann,
    overlapp, maxLiv,
    klar30: petAfter <= EPBD_TROSKEL_2030,
    klar33: petAfter <= EPBD_TROSKEL_2033,
  };
}

export type PaketKandidat = {
  atgard: Atgard;
  namn: string;
  petD: number;
  invest: number;
  besparKr: number;
  payback: number;
  schablon: boolean;
  effekt: number;
  newPet: number;
};

/** Förslagslista över tillämpliga åtgärder att lägga till, rankad efter EPBD-effekt per krona. */
export function paketKandidater(r: PaketResult, priser: Priser = defaultPriser()): PaketKandidat[] {
  const f = r.f;
  const inPaket = new Set(r.rows.map((p) => p.atgard));

  // Pool-rest efter befintliga åtgärder
  const pool = {
    varme_el: f.varme_el || 0,
    varme_fjv: f.varme_fjv || 0,
    varme_olja: f.varme_olja || 0,
    tvv: (f.tvv_fjv || 0) + (f.tvv_el || 0) + (f.tvv_olja || 0),
    kyla_el: f.kyla_el || 0,
    fastighetsel: f.fastighetsel || 0,
  };
  const claimed: Record<string, number> = {};
  r.rows.forEach((p) => {
    const k = paketPoolKey(p.atgard);
    claimed[k] = (claimed[k] || 0) + p.kwh_just;
  });
  const heatTotal = pool.varme_el + pool.varme_fjv + pool.varme_olja;
  const heatClaimed =
    (claimed.varme_el || 0) + (claimed.varme_fjv || 0) + (claimed.varme_olja || 0) + (claimed.varme || 0);
  const grandTotal = heatTotal + pool.tvv + pool.kyla_el + pool.fastighetsel + (f.kyla_fjk || 0);
  const totClaimed = Object.values(claimed).reduce((a, b) => a + b, 0);
  const poolRest: Record<string, number> = {
    varme_el: Math.max(0, pool.varme_el - (claimed.varme_el || 0) - (claimed.varme || 0)),
    varme_fjv: Math.max(0, pool.varme_fjv - (claimed.varme_fjv || 0) - (claimed.varme || 0)),
    varme_olja: Math.max(0, pool.varme_olja - (claimed.varme_olja || 0)),
    varme: Math.max(0, heatTotal - heatClaimed),
    tvv: Math.max(0, pool.tvv - (claimed.tvv || 0)),
    kyla_el: Math.max(0, pool.kyla_el - (claimed.kyla_el || 0)),
    fastighetsel: Math.max(0, pool.fastighetsel - (claimed.fastighetsel || 0)),
    mix: Math.max(0, grandTotal - totClaimed),
  };

  const kand: PaketKandidat[] = [];
  ATGARDER.forEach((a) => {
    if (inPaket.has(a.namn)) return;
    if (atgardRelevans(a, f) === "nej") return;
    const auto = getAutoParams(a, f);
    const schablon = !auto || !auto.p1;
    const g = (k: "p1" | "p2" | "p3" | "p4", fallback: number | undefined) =>
      auto && (auto as any)[k] !== undefined ? (auto as any)[k] : fallback ?? 0;

    let eb = 0, en = 0;
    if (a.typ === "kWh_direkt") { eb = g("p1", a.p1); en = g("p2", a.p2); }
    else if (a.typ === "kW") { const d = g("p3", a.p3 || 5840); eb = g("p1", a.p1) * d; en = g("p2", a.p2) * d; }
    else if (a.typ === "Verkningsgrad") {
      const c2 = g("p2", a.p2), c3 = g("p3", a.p3), p1v = g("p1", a.p1);
      eb = c2 !== 0 ? p1v / c2 : p1v;
      en = c3 !== 0 ? p1v / c3 : 0;
    } else if (a.typ === "U-varde" || a.typ === "SFP") {
      const p3 = g("p3", a.p3), p4 = g("p4", a.p4);
      eb = g("p1", a.p1) * p3 * p4;
      en = g("p2", a.p2) * p3 * p4;
    } else if (a.typ === "kWh_PV") {
      const kWp = Math.min(200, Math.round((f.atemp || 1000) * 0.05));
      const spec = f.reg === "Nord" ? 850 : f.reg === "Syd" ? 1050 : 950;
      eb = g("p1", f.fastighetsel || a.p1);
      en = Math.max(0, eb - kWp * spec * 0.85);
    } else return;
    if (!(eb > en)) return;

    const rest = poolRest[paketPoolKey(a.namn)] ?? Infinity;
    const cap = Math.min(1, rest > 0 ? rest / (eb - en) : 0);
    if (cap <= 0.02) return;
    en = eb - (eb - en) * cap;

    const bb = resolveBarare(a.bar_bef, f);
    const bn = resolveBarare(a.bar_ny, f);
    const mx = mixFaktorer(f, priser);
    const pefB = bb === "mix" ? mx.pef : (PEF_BARARE[bb] || 1.8);
    const pefN = bn === "mix" ? mx.pef : (PEF_BARARE[bn] || 1.8);
    const prisB = bb === "mix" ? mx.pris : getPris(bb, priser);
    const prisN = bn === "mix" ? mx.pris : getPris(bn, priser);
    const petD = Math.max(0, eb * pefB - en * pefN) / (f.atemp || 1);
    if (petD <= 0.05) return;

    let invest: number;
    if (a.invest_kr_kWp) {
      invest = Math.min(200, Math.round((f.atemp || 1000) * 0.05)) * a.invest_kr_kWp;
    } else {
      const fix = a.invest_fix !== undefined ? a.invest_fix : a.invest;
      invest = (fix + (a.invest_kr_m2 || 0) * (f.atemp || 0)) || a.invest;
    }
    const besparKr = (eb * prisB - en * prisN) + ((a.uh_bef || 0) - (a.uh_ny || 0));
    const payback = besparKr > 0 ? invest / besparKr : Infinity;
    kand.push({
      atgard: a, namn: a.namn, petD, invest, besparKr, payback, schablon,
      effekt: (petD / Math.max(invest, 1)) * 1e6,
      newPet: Math.max(0, r.petAfter - petD),
    });
  });

  kand.sort((x, y) => (y.effekt - x.effekt) || (x.payback - y.payback));
  return kand;
}

export function paketMal(r: PaketResult): { txt: string; pet: number } | null {
  if (r.petAfter > EPBD_TROSKEL_2030) return { txt: "EPBD 2030", pet: EPBD_TROSKEL_2030 };
  if (r.petAfter > EPBD_TROSKEL_2033) return { txt: "EPBD 2033", pet: EPBD_TROSKEL_2033 };
  return null;
}
