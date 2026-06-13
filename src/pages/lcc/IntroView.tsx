import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Rocket, AlertTriangle, Building2, FlaskConical } from "lucide-react";
import { FASTIGHETER_RAW, EPBD_TROSKEL_2030, EPBD_TROSKEL_2033 } from "@/lib/lcc/calc";
import { useLcc } from "./lcc-context";

const STEGEN = [
  { n: 0, t: "Välj fastighet", d: "Välj i dropdown. Atemp, PET, energiklass, EPBD-status och uppvärmningskälla hämtas och visas direkt från ED. Välj \"VALFRI\" för generisk kalkyl utan EPBD-koppling." },
  { n: 1, t: "Välj åtgärdstyp", d: "32 åtgärder: BRAND, BV, FÖNSTER, ISOL, KLIMAT, LED, LUFTRIDÅ, PORT, PUMP, PV, SOL, STYR, TAK, TÄT, VENT, VP, VÅV. Rekommenderade för fastighetens energibärare visas först, ej tillämpliga spärras." },
  { n: 2, t: "Autofyllning", d: "Energi bef & ny hämtas automatiskt från fastighetens ED-data och matchas mot åtgärdstyp. Investering skalas med Atemp (fast grundkostnad + kr/m²). Alla värden är redigerbara." },
  { n: 3, t: "Justera indata", d: "Kontrollera förvalda värden mot offert eller uppmätta driftsdata. Bärarspecifika energipriser, kalkylränta, livslängd och underhåll kan alltid justeras manuellt." },
  { n: 4, t: "Resultat & kassaflöde", d: "Energibesparing, payback, LCC-jämförelse och NPV uppdateras i realtid. Kassaflödesdiagram + tabell visar break-even visuellt och numeriskt." },
  { n: 5, t: "EPBD-påverkan", d: "Nytt PET beräknas bärarkorrekt: energi bef × VF(bef) − energi ny × VF(ny), per Boverkets viktningsfaktorer (el 1,8 · fjv 0,7 · pellets 0,6). Kalkylatorn indikerar om åtgärden löser EPBD 2030/2033." },
  { n: 6, t: "Åtgärdspaket", d: "Klicka \"Lägg till i paket\" för att kombinera flera åtgärder i samma projekt: total investering, paket-payback och samlad EPBD-effekt. Överlapp på samma energipost justeras automatiskt, och kalkylatorn föreslår nästa åtgärd för att nå EPBD-målet." },
];

export default function IntroView() {
  const { setTab } = useLcc();
  const stats = useMemo(() => {
    const fast = FASTIGHETER_RAW.filter((f) => f.nr !== "VALFRI");
    const med = fast.filter((f) => f.pet !== null && f.pet !== undefined);
    const atempTotal = fast.reduce((s, f) => s + (f.atemp || 0), 0);
    return {
      total: fast.length,
      ej2030: med.filter((f) => (f.pet || 0) > EPBD_TROSKEL_2030).length,
      ej2033: med.filter((f) => (f.pet || 0) > EPBD_TROSKEL_2033).length,
      saknar: fast.length - med.length,
      atempTotal,
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* HERO */}
      <Card className="p-6 md:p-10 bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary/20 relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <p className="text-xs uppercase tracking-wider text-primary font-bold">
            Livscykelkostnadsanalys · LCC
          </p>
          <h2 className="font-heading text-2xl md:text-4xl font-bold text-foreground leading-tight">
            LCC-kalkylator för fastighetsinvesteringar
          </h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Beräkna payback, NPV och EPBD-påverkan för energi- och underhållsåtgärder i SHF:s bestånd.
            Kalkylen är kopplad till energideklarationsdata (ED) per fastighet och skalas automatiskt efter Atemp.
          </p>
          <div className="pt-2">
            <Button size="lg" onClick={() => setTab("lcc")} className="gap-2">
              <Rocket className="h-4 w-4" /> Starta kalkyl
            </Button>
          </div>
        </div>
        {/* Decoration */}
        <svg className="absolute right-0 top-0 h-full w-1/3 opacity-10 hidden md:block" viewBox="0 0 200 200" fill="none">
          <ellipse cx="100" cy="100" rx="80" ry="90" fill="currentColor" className="text-primary" />
          <line x1="100" y1="10" x2="100" y2="190" stroke="currentColor" strokeWidth="3" className="text-primary-foreground" />
          <line x1="40" y1="60" x2="160" y2="60" stroke="currentColor" strokeWidth="1.5" className="text-primary-foreground" />
          <line x1="30" y1="100" x2="170" y2="100" stroke="currentColor" strokeWidth="1.5" className="text-primary-foreground" />
          <line x1="40" y1="140" x2="160" y2="140" stroke="currentColor" strokeWidth="1.5" className="text-primary-foreground" />
        </svg>
      </Card>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Building2 className="h-4 w-4" />} label="Fastigheter med ED-data" value={(stats.total - stats.saknar).toLocaleString("sv")} tone="primary" />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label={`Klarar ej EPBD 2030 (PET>${EPBD_TROSKEL_2030})`} value={stats.ej2030.toLocaleString("sv")} tone="warning" />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label={`Klarar ej EPBD 2033 (PET>${EPBD_TROSKEL_2033})`} value={stats.ej2033.toLocaleString("sv")} tone="destructive" />
        <StatCard icon={<FlaskConical className="h-4 w-4" />} label="Total Atemp (m²)" value={Math.round(stats.atempTotal).toLocaleString("sv")} tone="muted" />
      </div>

      {/* STEG */}
      <div>
        <h3 className="font-heading text-base font-bold text-foreground mb-3">📋 Så här använder du kalkylatorn</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STEGEN.map((s) => (
            <Card key={s.n} className="p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-baseline gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-heading font-bold text-sm shrink-0">
                  {s.n}
                </div>
                <div className="font-heading text-sm font-bold text-foreground">{s.t}</div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.d}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* KÄLLOR */}
      <Card className="p-4 md:p-5">
        <h3 className="font-heading text-base font-bold mb-1 text-foreground">🔍 Varifrån kommer de förvalda värdena?</h3>
        <p className="text-xs text-muted-foreground mb-3">Klicka på en rad för att läsa mer.</p>
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="ed">
            <AccordionTrigger className="text-sm">📄 Energi befintlig & uppvärmningskälla</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>Kolumnerna <strong>Värme – fjärrvärme, Värme – el, Värme – eldningsolja, TVV, Kyla och Fastighetsel</strong> (kWh/år) läses direkt från SHF:s byggnadslista som bygger på registrerade energideklarationer (Boverket ED-register).</p>
              <p>Rätt energibärare matchas automatiskt mot vald åtgärdstyp:</p>
              <ul className="list-disc pl-5 space-y-0.5 text-xs">
                <li><strong>BV – Elpanna → BV:</strong> använder "Värme – el"</li>
                <li><strong>BV – Oljepanna → BV:</strong> använder "Värme – olja"</li>
                <li><strong>BV / VÅV – Fjärrvärme →:</strong> använder "Värme – fjv"</li>
                <li><strong>LED / STYR / PV:</strong> använder "Fastighetsel"</li>
                <li><strong>PV – Solfångare:</strong> använder "TVV – el" eller "TVV – fjv"</li>
              </ul>
              <p className="text-amber-700 dark:text-amber-500 text-xs">⚠ Saknas ED-data visas generiska standardvärden. Kontrollera alltid mot driftsdata eller mätare.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="invest">
            <AccordionTrigger className="text-sm">💰 Investering (Atemp-skalad)</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <p><strong>Invest = invest_fix + invest_kr_m² × Atemp.</strong> En 5 000 m²-fastighet får automatiskt högre investering än en 600 m²-fastighet för samma åtgärd. Exempel på skalning:</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 text-foreground"><th className="text-left p-1.5">Åtgärd</th><th className="text-right p-1.5">Fast (kr)</th><th className="text-right p-1.5">Rörlig (kr/m²)</th></tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border"><td className="p-1.5">LED – armaturbyte</td><td className="p-1.5 text-right">20 000</td><td className="p-1.5 text-right">400</td></tr>
                  <tr className="border-t border-border"><td className="p-1.5">BV – Elpanna → BV + frikyla</td><td className="p-1.5 text-right">100 000</td><td className="p-1.5 text-right">250</td></tr>
                  <tr className="border-t border-border"><td className="p-1.5">BV – Fjärrvärme → Bergvärme</td><td className="p-1.5 text-right">100 000</td><td className="p-1.5 text-right">300</td></tr>
                  <tr className="border-t border-border"><td className="p-1.5">VÅV – Fjärrvärme → CO₂-VÅV</td><td className="p-1.5 text-right">50 000</td><td className="p-1.5 text-right">150</td></tr>
                  <tr className="border-t border-border"><td className="p-1.5">PV – Solcellsanläggning</td><td className="p-1.5 text-right" colSpan={2}>kWp × invest_kr_kWp (≈ 9 500 kr/kWp)</td></tr>
                </tbody>
              </table>
              <p className="text-xs">Källor: BELOK Totalmetodik, BELIVS, RISE, KTH-rapporter och SHF:s egen erfarenhetsdata.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="formler">
            <AccordionTrigger className="text-sm">∑ LCC-formler</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-1.5 font-mono text-xs">
              <p><strong>Annuitet:</strong> a = (1 − (1+r)^−N) / r</p>
              <p><strong>LCC bef:</strong> (energikostn + uh) × a</p>
              <p><strong>LCC ny:</strong> invest + (energikostn + uh) × a − restvärde / (1+r)^N</p>
              <p><strong>NPV:</strong> besparing × a − invest + restvärde / (1+r)^N</p>
              <p><strong>Payback:</strong> invest / (årlig energi- + uh-besparing)</p>
              <p><strong>PET-reduktion:</strong> (energi_bef × VF_bef − energi_ny × VF_ny) / Atemp</p>
              <p className="text-foreground font-sans normal-case font-normal pt-1">VF (Boverket): el 1,8 · fjärrvärme 0,7 · pellets 0,6 · olja 1,8 · fjärrkyla 0,6.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="ny">
            <AccordionTrigger className="text-sm">⚡ Energi efter åtgärd</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>För varje åtgärdstyp finns en specifik beräkningsmodell:</p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li><strong>BV/VP/VÅV:</strong> region-justerad SCOP (Nord 3,5 · Mitt 3,8 · Syd 4,0) eller täckningsgrad (65–92 %) appliceras på befintlig värmeförbrukning.</li>
                <li><strong>LED:</strong> drifttid × (kW bef − kW ny). Effekt bef uppskattas från 40 % av fastighetsel ÷ drifttid; ny ≈ 23–29 % av bef.</li>
                <li><strong>FÖNSTER/ISOL/TAK/TÄT:</strong> U-värde × area × gradtimmar, region-justerade gradtimmar.</li>
                <li><strong>PV:</strong> kWp × specifik produktion (Nord 850 · Mitt 950 · Syd 1 050 kWh/kWp/år) × 0,85 systemverkningsgrad.</li>
                <li><strong>STYR:</strong> ~15 % besparing på total värme + fastighetsel; Nattsänkning ~7 %.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="uh">
            <AccordionTrigger className="text-sm">🔧 Underhåll bef & ny</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>Underhållskostnader per åtgärd kommer från SHF:s ramavtal och branschnyckeltal. <strong>Ofta större besparing än energin</strong> – exempelvis byte av brandlarmcentral (11 500 → 6 000 kr/år) eller modern värmepump (4 000 → 3 000 kr/år).</p>
              <p>Underhållsskillnaden räknas in i payback och NPV, så att en åtgärd med liten energibesparing men låg drift kan bli lönsam.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="epbd">
            <AccordionTrigger className="text-sm">🇪🇺 EPBD-trösklar & klasspann</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>EU:s reviderade EPBD (2024) ställer krav på de sämsta byggnaderna:</p>
              <ul className="list-disc pl-5 text-xs space-y-0.5">
                <li><strong>2030:</strong> Topp 16 % sämst presterande icke-bostäder måste renoveras. Tröskel: PET ≤ <strong>{EPBD_TROSKEL_2030}</strong> kWh/m²/år.</li>
                <li><strong>2033:</strong> Topp 26 % sämst presterande. Tröskel: PET ≤ <strong>{EPBD_TROSKEL_2033}</strong> kWh/m²/år.</li>
              </ul>
              <p>Uppskattad energiklass efter åtgärd visas som ett <strong>spann (±1 klass)</strong> eftersom exakt klassgräns beror på klimatzon och lokaltyp, vilket vi inte alltid har i ED. Bekräftas med ny energideklaration.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    </div>
  );
}

function StatCard({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: string; tone: "primary" | "warning" | "destructive" | "muted" }) {
  const toneMap = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    warning: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400",
    destructive: "border-destructive/30 bg-destructive/5 text-destructive",
    muted: "border-border bg-muted/30 text-muted-foreground",
  };
  return (
    <Card className={`p-4 ${toneMap[tone]} border`}>
      <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide opacity-80">
        {icon} <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 font-heading text-2xl md:text-3xl font-bold text-foreground tabular-nums">{value}</div>
    </Card>
  );
}
