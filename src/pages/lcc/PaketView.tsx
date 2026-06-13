import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, Plus, Trash2, X, Lightbulb, Info } from "lucide-react";
import { useLcc } from "./lcc-context";
import { paketBerakna, paketKandidater, paketMal } from "@/lib/lcc/paket";
import {
  ATGARDER, EPBD_TROSKEL_2030, EPBD_TROSKEL_2033,
  getAutoParams, getScaledInvest, getBararFaktorer, berakna,
  defaultPriser, FASTIGHETER_RAW, fmtKr,
} from "@/lib/lcc/calc";

export default function PaketView() {
  const { paket, paketFastighet, paketRemove, paketClear, paketAdd, setTab, setFastighetVis, setAtgardIdx } = useLcc();

  const r = useMemo(() => paketBerakna(paket, paketFastighet), [paket, paketFastighet]);
  const kandidater = useMemo(() => (r ? paketKandidater(r) : []), [r]);
  const mal = r ? paketMal(r) : null;

  if (!r) {
    return (
      <Card className="p-6 md:p-8 text-center space-y-4">
        <Package className="h-10 w-10 mx-auto text-muted-foreground" />
        <div>
          <h3 className="font-heading text-lg font-bold">Åtgärdspaket är tomt</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
            Välj fastighet och åtgärd i Kalkyl-vyn, kontrollera värdena – och klicka{" "}
            <strong>Lägg till i paket</strong>. Här ser du sedan total investering, payback och EPBD-effekt
            för kombinationen, med automatiskt överlappsskydd när flera åtgärder delar samma energipost.
          </p>
        </div>
        <Button onClick={() => setTab("lcc")} variant="default">
          <Plus className="h-4 w-4 mr-1.5" /> Gå till Kalkyl
        </Button>
      </Card>
    );
  }

  const verdictCls = r.klar33
    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
    : r.klar30
      ? "bg-lime-500/10 border-lime-500/30 text-lime-700 dark:text-lime-400"
      : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-500";
  const verdictText = r.klar33
    ? `✅ Klarar EPBD 2033 (≤${EPBD_TROSKEL_2033})`
    : r.klar30
      ? `🟢 Klarar EPBD 2030 (≤${EPBD_TROSKEL_2030}), ej 2033`
      : `🟡 Klarar ej EPBD 2030 (kräver ≤${EPBD_TROSKEL_2030})`;

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-heading text-lg font-bold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Paket för {r.f.vis}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Nuläge PET <strong>{r.f.pet}</strong> kWh/m²/år · Klass <strong>{r.f.klass}</strong> · Atemp{" "}
              {r.f.atemp?.toLocaleString("sv")} m² · {r.rows.length} åtgärder i paketet
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => paketClear()}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Töm paket
          </Button>
        </div>

        {r.overlapp && (
          <div className="text-xs flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-500">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Överlapp justerat – två eller fler åtgärder delar samma energipost. Besparingen
              nedskalas så att totalbesparingen aldrig överstiger fastighetens faktiska förbrukning.</span>
          </div>
        )}

        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-xs tabular-nums min-w-[640px]">
            <thead>
              <tr className="border-b border-border text-right text-muted-foreground">
                <th className="text-left py-2 px-3 font-medium">Åtgärd</th>
                <th className="py-2 px-2 font-medium">kWh/år</th>
                <th className="py-2 px-2 font-medium">kr/år</th>
                <th className="py-2 px-2 font-medium">Invest kr</th>
                <th className="py-2 px-2 font-medium">ΔPET</th>
                <th className="py-2 px-2" />
              </tr>
            </thead>
            <tbody className="text-right">
              {r.rows.map((p, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="text-left py-2 px-3 font-medium">
                    {p.atgard}
                    {p.skala < 1 && (
                      <span className="ml-1 text-amber-600" title="Besparingen nedskalad pga överlapp">⚠️</span>
                    )}
                  </td>
                  <td className="py-2 px-2">{fmtKr(p.kwh_just)}</td>
                  <td className="py-2 px-2">{fmtKr(p.kr_just)}</td>
                  <td className="py-2 px-2">{fmtKr(p.invest)}</td>
                  <td className="py-2 px-2">−{p.petD_just.toFixed(1).replace(".", ",")}</td>
                  <td className="py-2 px-2">
                    <button
                      onClick={() => paketRemove(i)}
                      className="text-destructive hover:bg-destructive/10 rounded p-1"
                      aria-label="Ta bort"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-bold text-right">
                <td className="text-left py-2.5 px-3">TOTALT ({r.rows.length} åtgärder)</td>
                <td className="py-2.5 px-2">{fmtKr(r.sumKwh)}</td>
                <td className="py-2.5 px-2">{fmtKr(r.sumBesparKr)}</td>
                <td className="py-2.5 px-2">{fmtKr(r.sumInvest)}</td>
                <td className="py-2.5 px-2">−{r.sumPetDelta.toFixed(1).replace(".", ",")}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Metric label="Total investering" value={`${fmtKr(r.sumInvest)} kr`} tone="primary" />
          <Metric label="Besparing år 1" value={`${fmtKr(r.sumBesparKr)} kr/år`} tone="accent" />
          <Metric label="Paket-payback" value={isFinite(r.payback) ? `${r.payback.toFixed(1)} år` : "—"} tone="warning" />
          <Metric
            label="PET efter paket"
            value={`${r.petAfter.toFixed(0)} kWh/m²/år`}
            sub={r.spann ? `uppsk. klass ${r.spann.low !== r.spann.high ? `${r.spann.low}–${r.spann.high}` : r.spann.mid}` : ""}
            tone="primary"
          />
        </div>

        <div className={`text-sm p-3 rounded-md border font-semibold ${verdictCls}`}>
          {verdictText} · uppskattning – bekräftas med ny ED
        </div>
      </Card>

      {kandidater.length > 0 && (
        <Card className="p-4 md:p-5 space-y-3">
          <div>
            <h4 className="font-heading text-sm font-bold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-accent" /> Tillämpliga åtgärder att addera ({kandidater.length} st)
              {mal && <Badge variant="outline" className="ml-1 text-[10px]">Mål: {mal.txt} (≤{mal.pet})</Badge>}
              {!mal && <Badge variant="secondary" className="ml-1 text-[10px]">Fastigheten klarar redan båda kraven</Badge>}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rankade efter EPBD-effekt per investerad krona. ⓘ = schablonvärden, justeras efter tillägg.
            </p>
          </div>
          <div className="max-h-[420px] overflow-y-auto pr-1 space-y-2">
            {kandidater.map((k) => (
              <div
                key={k.namn}
                className="flex items-center justify-between gap-2 p-2.5 border border-dashed border-border rounded-md text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {k.namn}
                    {k.schablon && (
                      <span className="ml-1 opacity-60" title="Schablonvärden – fastighetsspecifik autodata saknas">ⓘ</span>
                    )}
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    −{k.petD.toFixed(1).replace(".", ",")} PET → ~{k.newPet.toFixed(0)} kWh/m²/år ·{" "}
                    ~{fmtKr(k.invest)} kr · payback{" "}
                    {isFinite(k.payback) ? `${k.payback.toFixed(1).replace(".", ",")} år` : "—"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Snabbaddera: gå till kalkyl med rätt fastighet+åtgärd OCH lägg i paket direkt
                    const idx = ATGARDER.findIndex((a) => a.namn === k.namn);
                    if (idx < 0) return;
                    const a = ATGARDER[idx];
                    const f = FASTIGHETER_RAW.find((x) => x.vis === r.f.vis);
                    if (!f) return;
                    const auto = getAutoParams(a, f) || {};
                    const inp = {
                      p1: (auto.p1 ?? a.p1) || 0,
                      p2: (auto.p2 ?? a.p2) || 0,
                      p3: (auto.p3 ?? a.p3 ?? 0) || 0,
                      p4: (auto.p4 ?? a.p4 ?? 0) || 0,
                      invest: getScaledInvest(a, f),
                      restvarde: 0,
                      livslangd: a.livslangd,
                      ranta: 7,
                      uh_bef: a.uh_bef,
                      uh_ny: a.uh_ny,
                    };
                    const priser = defaultPriser();
                    const c = berakna(a, inp, f, priser, "auto", "auto");
                    paketAdd({
                      atgard: a.namn,
                      fastighet: f.vis,
                      energi_bef: c.energi_bef,
                      energi_ny: c.energi_ny,
                      kostbesparing: c.kostbesparing,
                      invest: inp.invest,
                      livslangd: inp.livslangd,
                      pef_bef: c.bf.pef_bef,
                      pef_ny: c.bf.pef_ny,
                    });
                    // Speglar valet i kalkylen
                    setFastighetVis(f.vis);
                    setAtgardIdx(String(idx));
                  }}
                  className="shrink-0 h-7 text-[11px]"
                >
                  <Plus className="h-3 w-3 mr-1" /> Addera
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value, sub, tone }: {
  label: string; value: string; sub?: string; tone: "primary" | "accent" | "warning";
}) {
  const t = {
    primary: "bg-primary/5 border-primary/30 text-primary",
    accent: "bg-accent/10 border-accent/30 text-accent",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-500",
  }[tone];
  return (
    <div className={`p-3 rounded-md border ${t}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">{label}</div>
      <div className="font-heading text-lg font-bold mt-0.5 tabular-nums text-foreground">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
