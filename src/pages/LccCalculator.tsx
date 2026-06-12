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

  return (
    <div className="space-y-4">
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
        <TabsList className="grid grid-cols-3 w-full md:w-auto md:inline-flex print:hidden">
          <TabsTrigger value="intro" className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Översikt</span>
          </TabsTrigger>
          <TabsTrigger value="lcc" className="gap-1.5">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">Kalkyl</span>
          </TabsTrigger>
          <TabsTrigger value="prio" className="gap-1.5">
            <ListOrdered className="h-4 w-4" />
            <span className="hidden sm:inline">Prioritering</span>
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
