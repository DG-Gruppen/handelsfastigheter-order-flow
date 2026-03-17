import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Award, PartyPopper, Pen, BookOpen, ChevronRight } from "lucide-react";
import RecognitionDialog from "@/components/RecognitionDialog";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

const veckansVinst = {
  title: "Region Syd knäcker alla förväntningar",
  body: "Förvaltningsteam Syd har genomfört omförhandling av samtliga utgående avtal under Q1 med en genomsnittlig hyreshöjning på 4,2%. Detta stärker vår position som Skandinaviens bästa extern-handelsförvaltare. Stort tack till Peter Högberg, Julia Parker och Alexander Bertilsson!",
  author: "Petra Bondesson",
  week: "v.11 2026",
};

const vdBlogg = {
  title: "Reflektioner efter ett rekordår",
  date: "Q4 2025",
  excerpt: "2025 blev vårt starkaste år. Men det som gör mig mest stolt är inte siffrorna – det är hur vi nådde dit. Varje hyresförhandling, varje energimätning, varje felanmälan som hanterades inom 24 timmar. Det är ni som bygger SHF:s framgång. Tack.",
  author: "Thomas Holm",
};

interface Recognition {
  id: string;
  icon: string;
  message: string;
  created_at: string;
  from_name: string;
  to_name: string;
}

export default function Culture() {
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);

  const fetchRecognitions = useCallback(async () => {
    const { data } = await supabase
      .from("recognitions")
      .select("id, icon, message, created_at, from_user_id, to_user_id")
      .order("created_at", { ascending: false });
    if (!data) return;
    const userIds = [...new Set(data.flatMap((r: any) => [r.from_user_id, r.to_user_id]))];
    if (userIds.length === 0) { setRecognitions([]); return; }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);
    const nameMap: Record<string, string> = {};
    for (const p of (profiles ?? []) as any[]) nameMap[p.user_id] = p.full_name;
    setRecognitions(data.map((r: any) => ({
      id: r.id,
      icon: r.icon,
      message: r.message,
      created_at: r.created_at,
      from_name: nameMap[r.from_user_id] || "Okänd",
      to_name: nameMap[r.to_user_id] || "Okänd",
    })));
  }, []);

  useEffect(() => {
    fetchRecognitions();
  }, [fetchRecognitions]);

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
          <RecognitionDialog onCreated={fetchRecognitions} />
        </div>
        {recognitions.length === 0 && (
          <p className="text-sm text-muted-foreground">Inga erkännanden ännu. Var först med att uppmärksamma en kollega!</p>
        )}
        <div className="space-y-3">
          {recognitions.map((r) => (
            <div key={r.id} className="glass-card rounded-2xl p-4 flex gap-4">
              <span className="text-2xl shrink-0">{r.icon}</span>
              <div className="min-w-0">
                <div className="text-sm">
                  <span className="font-medium text-foreground">{r.from_name}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span className="font-medium text-foreground">{r.to_name}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{r.message}</p>
                <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                  {format(new Date(r.created_at), "d MMM yyyy", { locale: sv })}
                </span>
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
