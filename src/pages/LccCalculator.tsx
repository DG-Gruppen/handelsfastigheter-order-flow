import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Calculator, BookOpen, ListOrdered, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import IntroView from "./lcc/IntroView";
import CalcView from "./lcc/CalcView";
import PrioView from "./lcc/PrioView";

export default function LccCalculator() {
  const [tab, setTab] = useState<string>(() => {
    if (typeof window === "undefined") return "intro";
    const h = window.location.hash.replace("#", "");
    return ["intro", "lcc", "prio"].includes(h) ? h : "intro";
  });

  useEffect(() => {
    if (typeof window !== "undefined") window.location.hash = tab;
  }, [tab]);

  const today = new Date().toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" });
  const tabLabel = tab === "intro" ? "Översikt" : tab === "lcc" ? "Kalkyl" : "Prioritering";

  return (
    <div className="lcc-page space-y-4">
      {/* Print-only header */}
      <div className="lcc-print-header">
        <div>
          <h1>SHF · LCC-kalkylator</h1>
          <div style={{ fontSize: "9pt", color: "#555", marginTop: 2 }}>
            Livscykelkostnadsberäkning för energiåtgärder
          </div>
        </div>
        <div className="meta">
          <div><strong>{tabLabel}</strong></div>
          <div>Utskriven {today}</div>
          <div>Systemägare: Jörgen Larssen</div>
        </div>
      </div>

      <Card className="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">
            LCC-kalkylator
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Livscykelkostnadsberäkning för energiåtgärder · Systemägare: Jörgen Larssen
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="gap-1.5 self-start md:self-auto"
        >
          <Printer className="h-4 w-4" /> Skriv ut / PDF
        </Button>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full md:w-auto md:inline-flex print:hidden h-auto">
          <TabsTrigger value="intro" className="gap-1 sm:gap-1.5 py-2 text-[11px] sm:text-sm flex-col sm:flex-row h-auto">
            <BookOpen className="h-4 w-4" />
            <span>Översikt</span>
          </TabsTrigger>
          <TabsTrigger value="lcc" className="gap-1 sm:gap-1.5 py-2 text-[11px] sm:text-sm flex-col sm:flex-row h-auto">
            <Calculator className="h-4 w-4" />
            <span>Kalkyl</span>
          </TabsTrigger>
          <TabsTrigger value="prio" className="gap-1 sm:gap-1.5 py-2 text-[11px] sm:text-sm flex-col sm:flex-row h-auto">
            <ListOrdered className="h-4 w-4" />
            <span>Prioritering</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="intro" className="mt-0">
          <IntroView onStart={() => setTab("lcc")} />
        </TabsContent>
        <TabsContent value="lcc" className="mt-0">
          <CalcView />
        </TabsContent>
        <TabsContent value="prio" className="mt-0">
          <PrioView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

