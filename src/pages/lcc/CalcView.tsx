import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Building2, Zap, Coins, TrendingUp, Leaf, Plus, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  ATGARDER, FASTIGHETER_RAW, BARARE_LABEL,
  type Atgard, type Fastighet,
  defaultPriser, atgardRelevans, getAutoParams, getScaledInvest,
  getVarmeKalla, berakna, computeEPBD, fmtKr,
  EPBD_TROSKEL_2030, EPBD_TROSKEL_2033,
} from "@/lib/lcc/calc";
import { useLcc, type Category } from "./lcc-context";

const VALFRI = FASTIGHETER_RAW[0];

const CATEGORIES: { value: Category; label: string; icon: string; match: RegExp | null }[] = [
  { value: "", label: "Alla", icon: "📋", match: null },
  { value: "BRAND", label: "Brand & Säkerhet", icon: "🔥", match: /^BRAND/ },
  { value: "BV", label: "Bergvärme", icon: "🌍", match: /^BV/ },
  { value: "LED", label: "Belysning", icon: "💡", match: /^LED/ },
  { value: "PV", label: "Solenergi", icon: "☀️", match: /^PV|^SOL/ },
  { value: "VÅV", label: "Värmeåtervinning", icon: "♻️", match: /^VÅV/ },
  { value: "VENT", label: "Ventilation", icon: "💨", match: /^VENT/ },
];

export default function CalcView() {
  const {
    fastighetVis, setFastighetVis,
    atgardIdx, setAtgardIdx,
    category, setCategory,
    paketAdd,
  } = useLcc();

  // Säkerställ giltigt val
  useEffect(() => {
    if (!FASTIGHETER_RAW.some((f) => f.vis === fastighetVis)) setFastighetVis(VALFRI.vis);
  }, [fastighetVis, setFastighetVis]);

  const [ovBef, setOvBef] = useState<string>("auto");
  const [ovNy, setOvNy] = useState<string>("auto");
  const [showCfTable, setShowCfTable] = useState(false);

  // Calc inputs
  const [p1, setP1] = useState(0);
  const [p2, setP2] = useState(0);
  const [p3, setP3] = useState(0);
  const [p4, setP4] = useState(0);
  const [invest, setInvest] = useState(0);
  const [restvarde, setRestvarde] = useState(0);
  const [livslangd, setLivslangd] = useState(20);
  const [ranta, setRanta] = useState(7);
  const [uhBef, setUhBef] = useState(0);
  const [uhNy, setUhNy] = useState(0);

  // Priser
  const [priserEl, setPriserEl] = useState(1.8);
  const [priserFjv, setPriserFjv] = useState(0.95);
  const [priserOlja, setPriserOlja] = useState(1.6);
  const priser = useMemo(() => ({ ...defaultPriser(), el: priserEl, fjv: priserFjv, olja: priserOlja }), [priserEl, priserFjv, priserOlja]);

  const f: Fastighet | null = useMemo(
    () => FASTIGHETER_RAW.find((x) => x.vis === fastighetVis) || null,
    [fastighetVis]
  );
  const a: Atgard | null = useMemo(
    () => (atgardIdx !== "" ? ATGARDER[parseInt(atgardIdx)] : null),
    [atgardIdx]
  );

  // Grupperade åtgärder med kategori-filter
  const grouped = useMemo(() => {
    const cat = CATEGORIES.find((c) => c.value === category);
    const matchCat = (at: Atgard) => !cat?.match || cat.match.test(at.namn);
    if (!f || f.nr === "VALFRI") {
      return {
        rek: ATGARDER.map((a, i) => ({ a, i })).filter(({ a }) => matchCat(a)),
        ok: [] as { a: Atgard; i: number }[],
        nej: [] as { a: Atgard; i: number }[],
      };
    }
    const g: Record<string, { a: Atgard; i: number }[]> = { rek: [], ok: [], nej: [] };
    ATGARDER.forEach((at, i) => {
      if (!matchCat(at)) return;
      g[atgardRelevans(at, f)].push({ a: at, i });
    });
    return g;
  }, [f, category]);

  // Reset värden när åtgärd/fastighet ändras
  useEffect(() => {
    if (!a) return;
    const auto = f && f.nr !== "VALFRI" ? getAutoParams(a, f) : null;
    setP1((auto?.p1 ?? a.p1) || 0);
    setP2((auto?.p2 ?? a.p2) || 0);
    setP3((auto?.p3 ?? a.p3 ?? 0) || 0);
    setP4((auto?.p4 ?? a.p4 ?? 0) || 0);
    setInvest(getScaledInvest(a, f));
    setLivslangd(a.livslangd);
    setUhBef(a.uh_bef);
    setUhNy(a.uh_ny);
    setOvBef("auto"); setOvNy("auto");
  }, [atgardIdx, fastighetVis]); // eslint-disable-line react-hooks/exhaustive-deps

  // PV: auto-uppdatera p2 från kWp × spec × 0.85
  useEffect(() => {
    if (!a || a.typ !== "kWh_PV") return;
    const prod = p3 * p4 * 0.85;
    setP2(Math.max(0, Math.round(p1 - prod)));
    if (a.invest_kr_kWp) setInvest(Math.round(p3 * a.invest_kr_kWp));
  }, [p1, p3, p4, a]);

  const calc = useMemo(() => {
    if (!a) return null;
    return berakna(
      a,
      { p1, p2, p3, p4, invest, restvarde, livslangd, ranta, uh_bef: uhBef, uh_ny: uhNy },
      f,
      priser,
      ovBef,
      ovNy,
    );
  }, [a, f, p1, p2, p3, p4, invest, restvarde, livslangd, ranta, uhBef, uhNy, priser, ovBef, ovNy]);

  const epbd = useMemo(() => {
    if (!a || !calc || !f) return null;
    return computeEPBD(f, calc.energi_bef, calc.energi_ny, calc.bf.pef_bef, calc.bf.pef_ny);
  }, [a, calc, f]);

  const handleAddToPaket = () => {
    if (!a || !calc || !f) return;
    paketAdd({
      atgard: a.namn,
      fastighet: f.vis,
      energi_bef: calc.energi_bef,
      energi_ny: calc.energi_ny,
      kostbesparing: calc.kostbesparing,
      invest,
      livslangd,
      pef_bef: calc.bf.pef_bef,
      pef_ny: calc.bf.pef_ny,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* LEFT */}
      <div className="lg:col-span-2 space-y-4">
        {/* Kategori-snabbfilter */}
        <Card className="p-3 md:p-4 print:hidden">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Snabbfilter åtgärder
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.value || "all"}
                onClick={() => setCategory(c.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                  category === c.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-border text-foreground"
                }`}
              >
                <span className="mr-1">{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4 md:p-5 space-y-4">
          <h3 className="font-heading text-base font-bold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> 1. Välj fastighet & åtgärd
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Fastighet</Label>
              <Select value={fastighetVis} onValueChange={setFastighetVis}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {FASTIGHETER_RAW.map((fa) => (
                    <SelectItem key={fa.vis} value={fa.vis}>
                      {fa.nr === "VALFRI" ? fa.vis : `${fa.vis}${fa.kom ? ` [${fa.kom}${fa.reg ? " · " + fa.reg : ""}]` : ""}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Åtgärd</Label>
              <Select value={atgardIdx} onValueChange={setAtgardIdx}>
                <SelectTrigger><SelectValue placeholder="— Välj åtgärd —" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {grouped.rek.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>★ Rekommenderade för fastigheten</SelectLabel>
                      {grouped.rek.map(({ a, i }) => <SelectItem key={i} value={String(i)}>{a.namn}</SelectItem>)}
                    </SelectGroup>
                  )}
                  {grouped.ok.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Övriga tillämpliga</SelectLabel>
                      {grouped.ok.map(({ a, i }) => <SelectItem key={i} value={String(i)}>{a.namn}</SelectItem>)}
                    </SelectGroup>
                  )}
                  {grouped.nej.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Ej tillämpliga (fel energibärare)</SelectLabel>
                      {grouped.nej.map(({ a, i }) => <SelectItem key={i} value={String(i)} disabled>✗ {a.namn}</SelectItem>)}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {f && f.nr !== "VALFRI" && f.klass && (
            <div className="text-xs bg-muted/40 rounded-lg p-3 border border-border space-y-1">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span><strong>{f.vis}</strong></span>
                <span className="text-muted-foreground">· {f.kom} · Region {f.reg}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span>Atemp: <strong>{f.atemp?.toLocaleString("sv")} m²</strong></span>
                <span>PET: <strong>{f.pet} kWh/m²/år</strong></span>
                <span>Klass: <strong>{f.klass}</strong></span>
              </div>
              <div className="flex gap-2 flex-wrap pt-1">
                <Badge variant={f.e30 === "JA" ? "destructive" : "secondary"}>EPBD 2030: {f.e30 === "JA" ? "⚠ Krav" : "✓ OK"}</Badge>
                <Badge variant={f.e33 === "JA" ? "destructive" : "secondary"}>EPBD 2033: {f.e33 === "JA" ? "⚠ Krav" : "✓ OK"}</Badge>
              </div>
              <div className="text-muted-foreground">Uppvärmning: <strong className="text-foreground">{getVarmeKalla(f)}</strong></div>
            </div>
          )}

          {a && (
            <div className="text-xs bg-primary/5 border border-primary/20 rounded-lg p-3 leading-relaxed">
              <div className="font-semibold text-foreground mb-0.5">{a.namn}</div>
              <div className="text-muted-foreground">{a.beskrivning}</div>
            </div>
          )}
        </Card>

        {a && (
          <>
            <Card className="p-4 md:p-5 space-y-4">
              <h3 className="font-heading text-base font-bold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> 2. Energiparametrar
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <NumField label={a.lbl1 || "Parameter 1"} value={p1} onChange={setP1} />
                <NumField label={a.lbl2 || "Parameter 2"} value={p2} onChange={setP2} />
                {(a.typ === "kW" || a.typ === "Verkningsgrad" || a.typ === "U-varde" || a.typ === "kWh_PV" || a.typ === "SFP") && a.lbl3 && (
                  <NumField label={a.lbl3} value={p3} onChange={setP3} step="any" />
                )}
                {(a.typ === "kW" || a.typ === "Verkningsgrad" || a.typ === "U-varde" || a.typ === "kWh_PV" || a.typ === "SFP") && a.lbl4 && (
                  <NumField label={a.lbl4} value={p4} onChange={setP4} step="any" />
                )}
              </div>
            </Card>

            <Card className="p-4 md:p-5 space-y-4">
              <h3 className="font-heading text-base font-bold flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" /> 3. Investering, drift & finansiering
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <NumField label="Investering (kr)" value={invest} onChange={setInvest} />
                <NumField label="Restvärde (kr)" value={restvarde} onChange={setRestvarde} />
                <NumField label="Livslängd (år)" value={livslangd} onChange={setLivslangd} />
                <NumField label="Kalkylränta (%)" value={ranta} onChange={setRanta} step="0.01" />
                <NumField label="Underhåll bef (kr/år)" value={uhBef} onChange={setUhBef} />
                <NumField label="Underhåll ny (kr/år)" value={uhNy} onChange={setUhNy} />
              </div>
              <Separator />
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Energipriser</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <NumField label="El (kr/kWh)" value={priserEl} onChange={setPriserEl} step="0.01" />
                <NumField label="Fjärrvärme (kr/kWh)" value={priserFjv} onChange={setPriserFjv} step="0.01" />
                <NumField label="Olja (kr/kWh)" value={priserOlja} onChange={setPriserOlja} step="0.01" />
              </div>
            </Card>
          </>
        )}
      </div>

      {/* RIGHT */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Card className="p-4 md:p-5 space-y-3 bg-gradient-to-br from-primary/5 to-transparent border-primary/30">
          <h3 className="font-heading text-base font-bold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Resultat
          </h3>
          <ResultRow label="Energibesparing" value={calc ? `${fmtKr(calc.energibesparing)} kWh/år` : "—"} />
          <ResultRow label="Kostnadsbesparing" value={calc ? `${fmtKr(calc.kostbesparing)} kr/år` : "—"} />
          <ResultRow label="Payback" value={calc && isFinite(calc.payback) ? `${calc.payback.toFixed(1)} år` : "—"} highlight />
          <Separator />
          <ResultRow label="LCC befintlig" value={calc ? `${fmtKr(calc.lcc_bef)} kr` : "—"} subtle />
          <ResultRow label="LCC ny" value={calc ? `${fmtKr(calc.lcc_ny)} kr` : "—"} subtle />
          <ResultRow label="NPV (nuvärde)" value={calc ? `${fmtKr(calc.npv)} kr` : "—"} highlight />

          {calc && <PaybackMeter payback={calc.payback} kostbesparing={calc.kostbesparing} />}

          {a && f && f.nr !== "VALFRI" && calc && (
            <Button onClick={handleAddToPaket} className="w-full mt-1 print:hidden" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" /> Lägg till i paket (Steg 6)
            </Button>
          )}
        </Card>

        {calc && (
          <Card className="p-4 md:p-5 space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2"><Leaf className="h-4 w-4 text-accent" /> Klimatpåverkan</h4>
            <div className="text-3xl font-bold font-heading">{calc.co2_ar.toFixed(2)} <span className="text-base font-normal text-muted-foreground">ton CO₂/år</span></div>
            <p className="text-xs text-muted-foreground">
              ≈ {Math.round(calc.co2_ar * 1000 / 12)} träd/år · {(calc.co2_ar * livslangd).toFixed(1)} ton totalt över livslängden
            </p>
          </Card>
        )}

        {epbd && f?.pet && (
          <Card className="p-4 md:p-5 space-y-3">
            <h4 className="text-sm font-semibold">EPBD-status efter åtgärd</h4>
            <div className="grid grid-cols-2 gap-3">
              <EpbdBox letter={epbd.klassBefore || "—"} pet={epbd.petBefore} title="Före" />
              <EpbdBox
                letter={
                  epbd.spann && epbd.petAfter !== epbd.petBefore
                    ? (epbd.spann.low !== epbd.spann.high ? `${epbd.spann.low}–${epbd.spann.high}` : epbd.spann.mid)
                    : epbd.klassBefore || "—"
                }
                pet={epbd.petAfter}
                title="Efter (uppsk.)"
              />
            </div>
            <div className={`text-xs p-2.5 rounded-md border leading-relaxed ${
              epbd.loser2033 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400" :
              epbd.loser2030 ? "bg-lime-500/10 border-lime-500/30 text-lime-700 dark:text-lime-400" :
              "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-500"
            }`}>
              {calc && calc.energibesparing > 0 ? (
                <>~{epbd.petPct.toFixed(0)}% PET-reduktion → {epbd.petAfter?.toFixed(0)} kWh/m²/år ·{" "}
                  {epbd.loser2033 ? `Klarar EPBD 2033 (≤${EPBD_TROSKEL_2033})` :
                   epbd.loser2030 ? `Klarar EPBD 2030 (≤${EPBD_TROSKEL_2030}), ej 2033` :
                   `Klarar ej EPBD 2030 (kräver ≤${EPBD_TROSKEL_2030})`}
                </>
              ) : (
                <>Nuläge: Klass {epbd.klassBefore}, PET {epbd.petBefore} ·{" "}
                  {epbd.kraver2033 ? "⚠ Klarar ej 2033" : epbd.kraver2030 ? "⚠ Klarar ej 2030" : "✓ Klarar båda EPBD-kraven"}
                </>
              )}
            </div>
          </Card>
        )}

        {calc && (
          <Card className="p-4 md:p-5 space-y-2">
            <h4 className="text-sm font-semibold">Kassaflöde (kumulativt nuvärde)</h4>
            <CashflowChart cf={calc.cf} />
            <button
              onClick={() => setShowCfTable((v) => !v)}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1 print:hidden"
            >
              {showCfTable ? <><ChevronUp className="h-3 w-3" /> Dölj tabell</> : <><ChevronDown className="h-3 w-3" /> Visa tabell</>}
            </button>
            {showCfTable && (
              <CashflowTable
                cf={calc.cf}
                ekb={calc.energikostn_bef}
                ekn={calc.energikostn_ny}
                uhb={uhBef}
                uhn={uhNy}
              />
            )}
          </Card>
        )}

        {a && f && f.nr !== "VALFRI" && (
          <Card className="p-4 md:p-5 space-y-2">
            <h4 className="text-sm font-semibold">Energibärare</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <BararSelect label="Bef." value={ovBef} onChange={setOvBef} />
              <BararSelect label="Ny" value={ovNy} onChange={setOvNy} />
            </div>
            {calc && (
              <div className="text-xs text-muted-foreground pt-1">
                <strong>{labelBar(calc.bf.bar_bef)}</strong> (VF {calc.bf.pef_bef.toFixed(2).replace(".", ",")} · {calc.bf.pris_bef.toFixed(2).replace(".", ",")} kr/kWh) →{" "}
                <strong>{labelBar(calc.bf.bar_ny)}</strong> (VF {calc.bf.pef_ny.toFixed(2).replace(".", ",")} · {calc.bf.pris_ny.toFixed(2).replace(".", ",")} kr/kWh)
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="tabular-nums text-base sm:text-sm"
      />
    </div>
  );
}

function ResultRow({ label, value, highlight, subtle }: { label: string; value: string; highlight?: boolean; subtle?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={`text-xs ${subtle ? "text-muted-foreground" : ""}`}>{label}</span>
      <span className={`tabular-nums font-semibold ${highlight ? "text-lg text-primary" : subtle ? "text-sm" : "text-base"}`}>{value}</span>
    </div>
  );
}

function PaybackMeter({ payback, kostbesparing }: { payback: number; kostbesparing: number }) {
  if (!isFinite(payback) || kostbesparing <= 0) {
    return (
      <div className="text-xs text-center p-2 rounded-md bg-muted text-muted-foreground">
        {kostbesparing <= 0 ? "Negativ besparing – justera indata" : "—"}
      </div>
    );
  }
  const pct = Math.min(100, (payback / 20) * 100);
  let bar: string, text: string, cls: string;
  if (payback <= 2.5) { bar = "from-emerald-600 to-emerald-400"; text = "🚀 SUPER investering – Beställ direkt!"; cls = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"; }
  else if (payback <= 5) { bar = "from-green-600 to-green-400"; text = "✅ Mycket god investering"; cls = "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30"; }
  else if (payback <= 7) { bar = "from-lime-600 to-lime-400"; text = "💡 Värdeskapande – finns det fler skäl?"; cls = "bg-lime-500/15 text-lime-700 dark:text-lime-400 border-lime-500/30"; }
  else if (payback <= 12) { bar = "from-amber-600 to-amber-400"; text = "🔍 Villkorligt OK – kräver motivering"; cls = "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"; }
  else { bar = "from-destructive to-orange-400"; text = `⏳ Lång payback (${payback.toFixed(1)} år) – verifiera noga`; cls = "bg-destructive/15 text-destructive border-destructive/30"; }
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Payback-mätare</div>
      <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${bar} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground tabular-nums">
        <span>0</span><span>2,5</span><span>5</span><span>7</span><span>12</span><span>20+</span>
      </div>
      <div className={`text-xs text-center font-semibold p-2 rounded-md border ${cls}`}>{text}</div>
    </div>
  );
}

function EpbdBox({ letter, pet, title }: { letter: string; pet: number | null; title: string }) {
  const k = letter.length === 1 ? letter : "X";
  const colors: Record<string, string> = {
    A: "bg-emerald-500", B: "bg-green-500", C: "bg-lime-500",
    D: "bg-yellow-500", E: "bg-orange-500", F: "bg-red-500", G: "bg-red-700",
  };
  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground mb-1">{title}</div>
      <div className={`w-full h-14 rounded-md flex items-center justify-center font-heading font-bold text-white text-2xl ${colors[k] || "bg-muted"}`}>
        {letter}
      </div>
      <div className="text-xs text-muted-foreground mt-1">PET: {pet ? pet.toFixed(0) : "—"} kWh/m²/år</div>
    </div>
  );
}

function BararSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Auto</SelectItem>
          <SelectItem value="el">El</SelectItem>
          <SelectItem value="fjv">Fjärrvärme</SelectItem>
          <SelectItem value="fjk">Fjärrkyla</SelectItem>
          <SelectItem value="olja">Olja</SelectItem>
          <SelectItem value="pellets">Pellets</SelectItem>
          <SelectItem value="mix">Energimix</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function labelBar(b: string) {
  if (b === "mix") return "Energimix";
  return BARARE_LABEL[b] || b;
}

function CashflowChart({ cf }: { cf: { ar: number; kum: number; nv: number }[] }) {
  const w = 360, h = 180;
  const pad = { top: 12, right: 12, bottom: 22, left: 48 };
  const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
  const vals = cf.map((d) => d.kum);
  const minV = Math.min(0, ...vals), maxV = Math.max(0, ...vals);
  const range = maxV - minV || 1;
  const xs = (i: number) => pad.left + (i / Math.max(1, cf.length - 1)) * cw;
  const ys = (v: number) => pad.top + ch - ((v - minV) / range) * ch;
  const y0 = ys(0);
  const path = cf.map((d, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(d.kum)}`).join(" ");
  const fillPath = `${path} L${xs(cf.length - 1)},${y0} L${xs(0)},${y0} Z`;
  const beIdx = cf.findIndex((d) => d.kum >= 0 && d.ar > 0);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="cfG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t, i) => {
        const v = minV + t * range;
        const y = ys(v);
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={pad.left + cw} y2={y} stroke="hsl(var(--border))" strokeWidth="1" />
            <text x={pad.left - 4} y={y + 3} textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))">{Math.round(v / 1000)}k</text>
          </g>
        );
      })}
      <line x1={pad.left} y1={y0} x2={pad.left + cw} y2={y0} stroke="hsl(var(--foreground))" strokeWidth="1" opacity="0.4" />
      <path d={fillPath} fill="url(#cfG)" />
      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" />
      {beIdx > 0 && (
        <>
          <line x1={xs(beIdx)} y1={pad.top} x2={xs(beIdx)} y2={pad.top + ch} stroke="hsl(var(--accent))" strokeWidth="1.5" strokeDasharray="4 2" />
          <text x={xs(beIdx)} y={pad.top - 2} textAnchor="middle" fontSize="9" fill="hsl(var(--accent))" fontWeight="700">Break-even år {beIdx}</text>
        </>
      )}
      <text x={pad.left + cw / 2} y={h - 4} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">År (0 = idag)</text>
    </svg>
  );
}

function CashflowTable({ cf, ekb, ekn, uhb, uhn }: {
  cf: { ar: number; kum: number; nv: number }[]; ekb: number; ekn: number; uhb: number; uhn: number;
}) {
  const fmt = (n: number) => n !== 0 && isFinite(n) ? Math.round(n).toLocaleString("sv") : "–";
  return (
    <div className="overflow-x-auto max-h-72 -mx-4 md:mx-0 mt-2">
      <table className="w-full text-[11px] tabular-nums min-w-[560px]">
        <thead className="bg-muted/40 sticky top-0">
          <tr className="text-right text-muted-foreground">
            <th className="text-left py-1.5 px-2 font-medium">År</th>
            <th className="py-1.5 px-2 font-medium">Energi bef</th>
            <th className="py-1.5 px-2 font-medium">Energi ny</th>
            <th className="py-1.5 px-2 font-medium">UH bef</th>
            <th className="py-1.5 px-2 font-medium">UH ny</th>
            <th className="py-1.5 px-2 font-medium">Netto</th>
            <th className="py-1.5 px-2 font-medium">Nuvärde</th>
            <th className="py-1.5 px-2 font-medium">Kum. NV</th>
          </tr>
        </thead>
        <tbody>
          {cf.map((d) => {
            const prev = cf[Math.max(0, d.ar - 1)];
            const isBE = d.ar > 0 && d.kum >= 0 && prev.kum < 0;
            const netto = d.ar === 0 ? 0 : (ekb - ekn) + (uhb - uhn);
            const cls = isBE ? "bg-emerald-500/10 font-semibold" :
              d.kum > 0 ? "text-emerald-700 dark:text-emerald-400" :
              d.kum < 0 ? "text-destructive" : "";
            return (
              <tr key={d.ar} className={`border-b border-border/40 text-right ${cls}`}>
                <td className="text-left px-2 py-1">{d.ar}{isBE && " ★"}</td>
                <td className="px-2 py-1">{d.ar === 0 ? "–" : fmt(ekb)}</td>
                <td className="px-2 py-1">{d.ar === 0 ? "–" : fmt(ekn)}</td>
                <td className="px-2 py-1">{d.ar === 0 ? "–" : fmt(uhb)}</td>
                <td className="px-2 py-1">{d.ar === 0 ? "–" : fmt(uhn)}</td>
                <td className="px-2 py-1">{d.ar === 0 ? "–" : fmt(netto)}</td>
                <td className="px-2 py-1">{fmt(d.nv)}</td>
                <td className="px-2 py-1 font-bold">{fmt(d.kum)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
