import { ClipboardList, UserPlus, UserMinus, HelpCircle, CheckCircle2 } from "lucide-react";

/**
 * /boarding-plan
 * Sammanfattning för Petra (HR) av on- och offboarding-planerna.
 * Icke-teknisk. Fokus: vad vi vill bygga + de frågor vi behöver svar på.
 */

const onboardingOpen = [
  {
    q: "Fastighetslistor — varje gång eller löpande?",
    h: "När någon ny börjar: ska vi varje gång lägga en uppgift om att uppdatera fastighetslistorna? Eller är det något som hanteras separat utanför onboardingen?",
  },
];

const offboardingOpen = [
  {
    q: "Ska den som slutar få en egen checklista?",
    h: "Ett vänligt mejl med 'såhär lämnar du över' — t.ex. lämna in dator/nycklar, byt till privat mejl i Heartpace, hämta lönespecar. Bra eller överflödigt?",
  },
  {
    q: "Hur länge ska vi spara mejl och filer efter att någon slutat?",
    h: "Förslag: 90 dagar som standard, 5 år vid pension, och om det finns en pågående tvist hålls allt kvar tills HR säger till. Okej, eller andra tider?",
  },
  {
    q: "Var ska anteckningar från slutsamtalet sparas?",
    h: "Två alternativ: (a) i systemet, men låst så bara HR ser dem, eller (b) bara en bock 'slutsamtal genomfört' — anteckningar förs på papper/eget dokument.",
  },
  {
    q: "Ska vi skapa ett kort i Planner per offboarding?",
    h: "Så att HR har en visuell översikt i Kanban-stil över alla pågående avveckslingar. Eller räcker listan i /offboarding?",
  },
  {
    q: "Återrapportering efter 30 dagar?",
    h: "Ska chefen få ett automatiskt mejl en månad efter sista dagen som frågar 'är allt klart, hänger inget kvar?' — eller blir det bara brus?",
  },
  {
    q: "Om den som slutar är chef — vem tar över?",
    h: "Förslag: systemet föreslår automatiskt att hens medarbetare flyttas till leaverns chef, men HR måste alltid bekräfta. Bra, eller ska HR alltid välja från scratch?",
  },
];

const onboardingDecided = [
  "Alla chefer kan starta en onboarding.",
  "Ansvariga hämtas automatiskt från Verktyg-modulen — inga hårdkodade namn.",
  "Ett samlat mejl per ansvarig med alla deras punkter.",
  "Påminnelser går ut 7, 3 och 1 dag före startdatum (eskalering till chef vid T-1).",
  "Externa kontakter (t.ex. Agnes) bockar av sina punkter via en länk i mejlet — ingen inloggning.",
  "Heartpace-synken triggar onboarding automatiskt minst 48 h innan start.",
];

const offboardingDecided = [
  "Speglar onboarding — samma mall-byggare, samma mejl-flöde.",
  "Triggas manuellt av chef/HR, eller automatiskt när Heartpace ser ett slutdatum.",
  "Återlämning av dator/nycklar/passerkort är en egen checklista i offboarding-vyn — inte en beställning.",
  "Stöd för snabbavslut (samma dag), pension och 'juridisk hold' som stoppar arkivering.",
  "Konton i alla system (Google, Rillion, Vitec, Creditsafe m.fl.) stängs automatiskt via samma ägar-lista som onboarding använder.",
];

export default function BoardingPlan() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <header className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
            On- &amp; offboarding — sammanfattning för HR
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            En sida att gå igenom med Petra. Här är vad vi vill bygga — och de
            frågor vi behöver svar på innan vi sätter spaden i marken.
          </p>
        </div>
      </header>

      {/* Vad det handlar om */}
      <section className="bg-card border border-border rounded-lg p-6 space-y-3">
        <h2 className="font-heading text-lg font-semibold text-primary">
          Vad det handlar om
        </h2>
        <p className="text-foreground/85 leading-relaxed">
          Två kompletta flöden i intranätet — ett när någon börjar, ett när
          någon slutar. Chef eller HR startar processen, och systemet skickar
          automatiskt rätt uppgifter till rätt person (IT, ekonomi, system­ägare,
          närmaste chef). Ingen ska falla mellan stolarna, ingen ska få samma
          mejl tre gånger, och allt går att följa upp i en checklista.
        </p>
      </section>

      {/* Två kolumner: onboarding + offboarding klart */}
      <section className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-6 space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-accent" />
            <h2 className="font-heading text-lg font-semibold text-primary">
              Onboarding — beslutat
            </h2>
          </div>
          <ul className="space-y-2">
            {onboardingDecided.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-foreground/85">
                <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 space-y-3">
          <div className="flex items-center gap-2">
            <UserMinus className="h-5 w-5 text-accent" />
            <h2 className="font-heading text-lg font-semibold text-primary">
              Offboarding — beslutat
            </h2>
          </div>
          <ul className="space-y-2">
            {offboardingDecided.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-foreground/85">
                <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Öppna frågor */}
      <section className="bg-warning/5 border border-warning/30 rounded-lg p-6 space-y-5">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-warning" />
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Frågor vi behöver svar på
          </h2>
        </div>

        {/* Onboarding */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Onboarding ({onboardingOpen.length})
          </h3>
          <ol className="space-y-4">
            {onboardingOpen.map((item, i) => (
              <li
                key={item.q}
                className="bg-card border border-border rounded-md p-4"
              >
                <div className="flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-accent/10 text-accent text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{item.q}</p>
                    <p className="text-sm text-foreground/75 leading-relaxed">
                      {item.h}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Offboarding */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Offboarding ({offboardingOpen.length})
          </h3>
          <ol className="space-y-4">
            {offboardingOpen.map((item, i) => (
              <li
                key={item.q}
                className="bg-card border border-border rounded-md p-4"
              >
                <div className="flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-accent/10 text-accent text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{item.q}</p>
                    <p className="text-sm text-foreground/75 leading-relaxed">
                      {item.h}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Nästa steg */}
      <section className="bg-card border border-border rounded-lg p-6 space-y-2">
        <h2 className="font-heading text-lg font-semibold text-primary">
          Nästa steg
        </h2>
        <p className="text-foreground/85 leading-relaxed">
          När frågorna ovan är besvarade kan vi börja bygga. Första leveransen
          blir onboarding-flödet (HR-vy, mallredigerare, automatiska mejl) —
          därefter offboarding som speglar samma struktur.
        </p>
        <p className="text-xs text-muted-foreground pt-2">
          Detaljerade planer:{" "}
          <a href="/onboarding-plan" className="text-accent hover:underline">
            /onboarding-plan
          </a>{" "}
          ·{" "}
          <a href="/offboarding-plan" className="text-accent hover:underline">
            /offboarding-plan
          </a>
        </p>
      </section>
    </div>
  );
}
