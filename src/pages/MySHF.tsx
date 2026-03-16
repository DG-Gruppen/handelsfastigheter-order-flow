import { Target, BookOpen, CheckCircle2, Circle, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const personalOkrs = [
  { title: "Minska vakansgrad i Region Syd till 3%", progress: 72, nextStep: "Boka möte med 2 prospekt i Bernstorp", parentOkr: "Skandinaviens bästa externhandelsportfölj" },
  { title: "Certifiera 5 fastigheter under 2026", progress: 40, nextStep: "Skicka in ansökan för Härlöv", parentOkr: "Hållbart klimat-positivt bestånd 2030" },
];

const learningLog = [
  { title: "Vitec – Grundkurs för förvaltare", date: "2026-02-15", duration: 45, completed: true },
  { title: "SHF:s hållbarhetsstrategi 2030", date: "2026-03-01", duration: 30, completed: true },
  { title: "Power BI – Förstå SHF:s dashboards", date: "2026-03-10", duration: 38, completed: false, progress: 67 },
];

const onboarding = [
  { group: "Dag 1", items: [
    { id: "d1-1", label: "Läs uppförandekoden", done: true },
    { id: "d1-2", label: "Boka lunch med din chef", done: true },
    { id: "d1-3", label: "Konfigurera Microsoft 365 och Teams", done: true },
    { id: "d1-4", label: 'Läs "Onboarding – din första vecka" i Kunskapsbanken', done: true },
  ]},
  { group: "Vecka 1", items: [
    { id: "w1-1", label: "Besök en handelsplats", done: true },
    { id: "w1-2", label: "Boka 30 min med CFO Malin Ekwall", done: true },
    { id: "w1-3", label: "Genomför Vitec-grundkursen", done: true },
    { id: "w1-4", label: "Fyll i din profil", done: false },
  ]},
  { group: "Månad 1", items: [
    { id: "m1-1", label: "Skriv ditt första bidrag till Kunskapsbanken", done: false },
    { id: "m1-2", label: "Delta i ett hyresgästmöte", done: false },
    { id: "m1-3", label: "Genomför obligatorisk brandskyddsutbildning", done: false },
  ]},
  { group: "Månad 3", items: [
    { id: "m3-1", label: "90-dagars check-in med HR (Petra Bondesson)", done: false },
    { id: "m3-2", label: "Sätt dina personliga OKRs", done: false },
  ]},
];

const totalOnboarding = onboarding.flatMap(g => g.items);
const doneCount = totalOnboarding.filter(i => i.done).length;
const onboardingPct = Math.round((doneCount / totalOnboarding.length) * 100);

export default function MySHF() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Mitt SHF</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Din personliga sida</p>
      </div>

      {/* Personal OKRs */}
      <Card className="glass-card">
        <CardHeader className="pb-2 px-4 md:px-6">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Mina mål
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 md:px-6 space-y-5">
          {personalOkrs.map((okr) => (
            <div key={okr.title}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">{okr.title}</span>
                <span className="text-sm font-bold text-foreground">{okr.progress}%</span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${okr.progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Nästa steg: {okr.nextStep}</p>
              <p className="text-[10px] text-muted-foreground/60">Kopplad till: {okr.parentOkr}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Learning log */}
      <Card className="glass-card">
        <CardHeader className="pb-2 px-4 md:px-6">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Min lärlogg
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 md:px-6 space-y-3">
          {learningLog.map((item) => (
            <div key={item.title} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              {item.completed ? (
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{item.title}</span>
                <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                  <span>{item.date}</span>
                  <span>{item.duration} min</span>
                  {!item.completed && item.progress && <span className="text-primary font-medium">{item.progress}% klart</span>}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Friskvård */}
      <Card className="glass-card">
        <CardHeader className="pb-2 px-4 md:px-6">
          <CardTitle className="font-heading text-base">💪 Min friskvårdsbudget</CardTitle>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-xl md:text-2xl font-heading font-bold">3 000 kr</div>
              <div className="text-xs text-muted-foreground">Total budget</div>
            </div>
            <div className="text-center">
              <div className="text-xl md:text-2xl font-heading font-bold text-accent">1 200 kr</div>
              <div className="text-xs text-muted-foreground">Förbrukat</div>
            </div>
            <div className="text-center">
              <div className="text-xl md:text-2xl font-heading font-bold text-primary">1 800 kr</div>
              <div className="text-xs text-muted-foreground">Återstår</div>
            </div>
          </div>
          <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: "40%" }} />
          </div>
          <Button size="sm" className="mt-4">Logga friskvård</Button>
        </CardContent>
      </Card>

      {/* Onboarding */}
      <Card className="glass-card">
        <CardHeader className="pb-2 px-4 md:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-base">🚀 Min onboarding</CardTitle>
            <span className="text-sm font-bold text-primary">{onboardingPct}%</span>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-6">
            <div className="h-full bg-primary rounded-full" style={{ width: `${onboardingPct}%` }} />
          </div>
          <div className="space-y-5">
            {onboarding.map((group) => (
              <div key={group.group}>
                <h3 className="text-sm font-semibold text-foreground mb-2">{group.group}</h3>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 text-sm">
                      {item.done ? (
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Help */}
      <div className="bg-secondary/50 rounded-lg p-6 text-center">
        <button className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <HelpCircle className="w-4 h-4" />
          Ja, jag behöver hjälp
        </button>
        <p className="text-[10px] text-muted-foreground mt-2">
          Det är okej att inte ha det bra. Petra på HR finns här för dig – helt konfidentiellt.
        </p>
      </div>
    </div>
  );
}
