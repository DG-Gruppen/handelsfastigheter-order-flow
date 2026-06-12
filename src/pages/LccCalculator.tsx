import { ExternalLink } from "lucide-react";

export default function LccCalculator() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] -mx-4 -my-4 md:-mx-6 md:-my-6">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-card">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">LCC-kalkylator</h1>
          <p className="text-xs text-muted-foreground">Livscykelkostnadsberäkning · Systemägare: Jörgen Seegh</p>
        </div>
        <a
          href="/lcc-kalkylator.html"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Öppna i ny flik <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <iframe
        src="/lcc-kalkylator.html"
        title="LCC-kalkylator"
        className="flex-1 w-full border-0 bg-background"
      />
    </div>
  );
}
