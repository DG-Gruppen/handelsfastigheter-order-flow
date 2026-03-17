import { Award, PartyPopper, Pen, BookOpen, ChevronRight } from "lucide-react";

const veckansVinst = {
  title: "Region Syd knäcker alla förväntningar",
  body: "Förvaltningsteam Syd har genomfört omförhandling av samtliga utgående avtal under Q1 med en genomsnittlig hyreshöjning på 4,2%. Detta stärker vår position som Skandinaviens bästa extern-handelsförvaltare. Stort tack till Peter Högberg, Julia Parker och Alexander Bertilsson!",
  author: "Petra Bondesson",
  week: "v.11 2026",
};

const recognitions = [
  { from: "Malin Ekwall", to: "Mats Jäverlind", value: "Erfarenhet", emoji: "⭐", message: "Tack för strålande årsredovisning – din noggrannhet gör skillnad!", date: "2026-03-14" },
  { from: "Knud Lauridsen", to: "Peter Högberg", value: "Driv", emoji: "🚀", message: "Fantastiskt arbete med Bernstorp-förvaltningen. Imponerad!", date: "2026-03-13" },
  { from: "Petra Bondesson", to: "Mikaela Karlsson", value: "Långsiktighet", emoji: "🌱", message: "Ditt engagemang för energiloggningen inspirerar hela teamet.", date: "2026-03-12" },
  { from: "Thomas Holm", to: "Malin Ekwall", value: "Erfarenhet", emoji: "⭐", message: "Din finansiella analys möjliggjorde den gröna obligationen. Tack!", date: "2026-03-10" },
  { from: "Benny Andersson", to: "Louise Eldwinger", value: "Samverkan", emoji: "🔗", message: "Otroligt bra samarbete med XXL-etableringen i Skövde!", date: "2026-03-09" },
];

const vdBlogg = {
  title: "Reflektioner efter ett rekordår",
  date: "Q4 2025",
  excerpt: "2025 blev vårt starkaste år. Men det som gör mig mest stolt är inte siffrorna – det är hur vi nådde dit. Varje hyresförhandling, varje energimätning, varje felanmälan som hanterades inom 24 timmar. Det är ni som bygger SHF:s framgång. Tack.",
  author: "Thomas Holm",
};

export default function Culture() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Kulturen</h1>
        <p className="text-sm text-muted-foreground mt-1">Det som gör SHF till SHF</p>
      </div>

      {/* Veckans vinst */}
      <div className="glass-card rounded-2xl border-2 border-warning/40 p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-6 h-6 text-warning" />
          <h2 className="font-heading text-xl font-semibold text-foreground">Veckans vinst</h2>
          <span className="text-xs text-muted-foreground ml-auto">{veckansVinst.week}</span>
        </div>
        <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{veckansVinst.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{veckansVinst.body}</p>
        <p className="text-xs text-warning font-medium mt-4">Publicerad av {veckansVinst.author}</p>
      </div>

      {/* Klapp på axeln */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PartyPopper className="w-5 h-5 text-primary" />
            <h2 className="font-heading text-xl font-semibold text-foreground">Klapp på axeln</h2>
          </div>
          <button className="text-xs font-medium bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors">
            Ge ett erkännande +
          </button>
        </div>
        <div className="space-y-3">
          {recognitions.map((r, i) => (
            <div key={i} className="glass-card rounded-2xl p-4 flex gap-4">
              <span className="text-2xl shrink-0">{r.emoji}</span>
              <div className="min-w-0">
                <div className="text-sm">
                  <span className="font-medium text-foreground">{r.from}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span className="font-medium text-foreground">{r.to}</span>
                  <span className="text-[10px] ml-2 bg-accent/15 text-accent px-2 py-0.5 rounded-full font-medium">{r.value}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{r.message}</p>
                <span className="text-[10px] text-muted-foreground/60 mt-1 block">{r.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* VD-bloggen */}
      <div className="rounded-2xl p-6 md:p-8 bg-[hsl(var(--sidebar-background))]">
        <div className="flex items-center gap-2 mb-4">
          <Pen className="w-5 h-5 text-[hsl(var(--sidebar-foreground))]/60" />
          <h2 className="font-heading text-xl font-semibold text-[hsl(var(--sidebar-foreground))]">Från styrelserummet</h2>
        </div>
        <h3 className="font-heading text-lg text-[hsl(var(--sidebar-foreground))] font-semibold mb-2">{vdBlogg.title}</h3>
        <p className="text-sm text-[hsl(var(--sidebar-foreground))]/70 leading-relaxed italic">"{vdBlogg.excerpt}"</p>
        <p className="text-xs text-[hsl(var(--sidebar-foreground))]/50 mt-4">— {vdBlogg.author}, {vdBlogg.date}</p>
      </div>

      {/* Karriärvägar */}
      <div className="rounded-2xl p-6 bg-accent/10">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-accent" />
          <h2 className="font-heading text-xl font-semibold text-foreground">Karriärvägar på SHF</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Var kan jag växa härifrån?</p>
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">Koordinator</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">Avtalsansvarig</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className="bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] text-xs px-3 py-1 rounded-full">Chef</span>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            "Marit gick från koordinator till avtalsansvarig på 2 år"
          </p>
        </div>
      </div>
    </div>
  );
}
