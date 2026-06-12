import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Rocket, AlertTriangle, Building2, FlaskConical } from "lucide-react";
import { FASTIGHETER_RAW, EPBD_TROSKEL_2030, EPBD_TROSKEL_2033 } from "@/lib/lcc/calc";

export default function IntroView({ onStart }: { onStart: () => void }) {
  const stats = useMemo(() => {
    const fast = FASTIGHETER_RAW.filter((f) => f.nr !== "VALFRI");
    const med = fast.filter((f) => f.pet !== null && f.pet !== undefined);
    return {
      total: fast.length,
      ej2030: med.filter((f) => (f.pet || 0) > EPBD_TROSKEL_2030).length,
      ej2033: med.filter((f) => (f.pet || 0) > EPBD_TROSKEL_2033).length,
      saknar: fast.length - med.length,
    };
  }, []);

  return (
    <div className="space-y-4">
      <Card className="p-6 md:p-8 bg-gradient-to-br from-primary/5 via-background to-accent/5 border-primary/20">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs uppercase tracking-wider text-primary font-semibold">
            Livscykelkostnadsanalys · LCC
          </p>
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground leading-tight">
            Jämför energiåtgärder med fakta — investering, drift, payback och EPBD-effekt
          </h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Välj en av {FASTIGHETER_RAW.length - 1} fastigheter, välj åtgärd, och se hela kalkylen –
            energibesparing, NPV, kassaflöde och uppskattad energiklass efter åtgärd.
          </p>
          <div className="pt-2">
            <Button size="lg" onClick={onStart} className="gap-2">
              <Rocket className="h-4 w-4" /> Starta kalkyl
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Building2 className="h-4 w-4" />} label="Fastigheter i registret" value={stats.total.toLocaleString("sv")} tone="primary" />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label={`Klarar EJ EPBD 2030 (PET > ${EPBD_TROSKEL_2030})`} value={stats.ej2030.toLocaleString("sv")} tone="warning" />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label={`Klarar EJ EPBD 2033 (PET > ${EPBD_TROSKEL_2033})`} value={stats.ej2033.toLocaleString("sv")} tone="destructive" />
        <StatCard icon={<FlaskConical className="h-4 w-4" />} label="Saknar fullständig ED-data" value={stats.saknar.toLocaleString("sv")} tone="muted" />
      </div>

      <Card className="p-4 md:p-5">
        <h3 className="font-heading text-base font-bold mb-3 text-foreground">Källor & metodik</h3>
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="ed">
            <AccordionTrigger className="text-sm">Energideklarationer (ED) · Boverket</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
              Fastigheternas PET-värden (primärenergital), energiklass A–G och uppmätta energibärare
              hämtas från fastighetens energideklaration. PET viktas enligt BBR med
              VF<sub>el</sub>=1,8 · VF<sub>fjv</sub>=0,7 · VF<sub>olja</sub>=1,8 · VF<sub>pellets</sub>=0,6 · VF<sub>fjk</sub>=0,6.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="formler">
            <AccordionTrigger className="text-sm">LCC-formler</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-1">
              <p><strong>Annuitet:</strong> a = (1 − (1+r)^−N) / r</p>
              <p><strong>LCC bef:</strong> (energikostn + uh) × a</p>
              <p><strong>LCC ny:</strong> invest + (energikostn + uh) × a − restvärde / (1+r)^N</p>
              <p><strong>NPV:</strong> besparing × a − invest + restvärde / (1+r)^N</p>
              <p><strong>Payback:</strong> invest / årlig besparing (energi + uh)</p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="epbd">
            <AccordionTrigger className="text-sm">EPBD-trösklar</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
              EPBD 2030: PET ≤ {EPBD_TROSKEL_2030} kWh/m²/år. EPBD 2033: PET ≤ {EPBD_TROSKEL_2033} kWh/m²/år.
              Den uppskattade klassen efter åtgärd visas som ett spann (±1 klass) eftersom det exakta
              gränsvärdet beror på klimatzon och lokaltyp.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="invest">
            <AccordionTrigger className="text-sm">Investeringskostnader</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
              Schabloner per åtgärd: <code className="bg-muted px-1 py-0.5 rounded">invest = invest_fix + invest_kr_m² × Atemp</code>.
              För PV: <code className="bg-muted px-1 py-0.5 rounded">invest = kWp × invest_kr_kWp</code>.
              Källor: BELOK Totalmetodik, BELIVS, RISE, KTH-rapporter.
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
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-80">
        {icon} <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 font-heading text-2xl md:text-3xl font-bold text-foreground">{value}</div>
    </Card>
  );
}
