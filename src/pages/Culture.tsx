import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Award, PartyPopper, Pen, BookOpen, ChevronRight, Pencil, Check, X } from "lucide-react";
import WeeklyCelebrations from "@/components/WeeklyCelebrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RecognitionDialog from "@/components/RecognitionDialog";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const veckansVinst = {
  title: "Region Syd knäcker alla förväntningar",
  body: "Förvaltningsteam Syd har genomfört omförhandling av samtliga utgående avtal under Q1 med en genomsnittlig hyreshöjning på 4,2%. Detta stärker vår position som Skandinaviens bästa extern-handelsförvaltare. Stort tack till Peter Högberg, Julia Parker och Alexander Bertilsson!",
  author: "Petra Bondesson",
  week: "v.11 2026",
};

interface Recognition {
  id: string;
  icon: string;
  message: string;
  created_at: string;
  from_name: string;
  to_name: string;
}

interface CeoBlog {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  period: string;
}

async function fetchRecognitionsData(): Promise<Recognition[]> {
  const { data } = await supabase
    .from("recognitions")
    .select("id, icon, message, created_at, from_user_id, to_user_id")
    .order("created_at", { ascending: false });
  if (!data) return [];
  const userIds = [...new Set(data.flatMap((r: any) => [r.from_user_id, r.to_user_id]))];
  if (userIds.length === 0) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", userIds);
  const nameMap: Record<string, string> = {};
  for (const p of (profiles ?? []) as any[]) nameMap[p.user_id] = p.full_name;
  return data.map((r: any) => ({
    id: r.id,
    icon: r.icon,
    message: r.message,
    created_at: r.created_at,
    from_name: nameMap[r.from_user_id] || "Okänd",
    to_name: nameMap[r.to_user_id] || "Okänd",
  }));
}

async function fetchCeoBlogData(): Promise<CeoBlog | null> {
  const { data } = await supabase
    .from("ceo_blog" as any)
    .select("id, title, excerpt, author, period")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return (data as any) ?? null;
}

export default function Culture() {
  const { roles, profile } = useAuth();
  const isAdmin = roles.includes("admin");
  const isIT = roles.includes("it");
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<CeoBlog | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: recognitions = [] } = useQuery({
    queryKey: ["culture-recognitions"],
    queryFn: fetchRecognitionsData,
    staleTime: 5 * 60 * 1000,
  });

  const { data: ceoBlog = null } = useQuery({
    queryKey: ["culture-ceo-blog"],
    queryFn: fetchCeoBlogData,
    staleTime: 5 * 60 * 1000,
  });

  const refreshRecognitions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["culture-recognitions"] });
  }, [queryClient]);

  const startEdit = () => {
    if (!ceoBlog) return;
    setEditForm({
      ...ceoBlog,
      author: profile?.full_name || ceoBlog.author,
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    setSaving(true);
    const { error } = await supabase
      .from("ceo_blog" as any)
      .update({
        title: editForm.title,
        excerpt: editForm.excerpt,
        author: editForm.author,
        period: editForm.period,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", editForm.id);
    if (error) {
      toast.error("Kunde inte spara");
    } else {
      toast.success("Uppdaterat!");
      queryClient.invalidateQueries({ queryKey: ["culture-ceo-blog"] });
      setEditing(false);
      setEditForm(null);
    }
    setSaving(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Kulturen</h1>
        <p className="text-sm text-muted-foreground mt-1">Det som gör SHF till SHF</p>
      </div>

      {/* Veckans jubilarer */}
      <WeeklyCelebrations />

      {/* Veckans vinst – only visible to IT group (see .lovable/culture-hidden-sections.md) */}
      {isIT && (
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
      )}

      {/* Klapp på axeln */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PartyPopper className="w-5 h-5 text-primary" />
            <h2 className="font-heading text-xl font-semibold text-foreground">Klapp på axeln</h2>
          </div>
          <RecognitionDialog onCreated={refreshRecognitions} />
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

      {/* VD-bloggen / Från styrelserummet */}
      {ceoBlog && (
        <div className="rounded-2xl p-6 md:p-8 bg-[hsl(var(--sidebar-background))] relative">
          {isAdmin && !editing && (
            <Button
              variant="ghost"
              size="icon"
              onClick={startEdit}
              className="absolute top-4 right-4 text-white/60 hover:text-white hover:bg-white/10"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}

          <div className="flex items-center gap-2 mb-4">
            <Pen className="w-5 h-5 text-white/60" />
            <h2 className="font-heading text-xl font-semibold text-white">Från styrelserummet</h2>
          </div>

          {editing && editForm ? (
            <div className="space-y-3">
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="Rubrik"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <Textarea
                value={editForm.excerpt}
                onChange={(e) => setEditForm({ ...editForm, excerpt: e.target.value })}
                placeholder="Text"
                rows={4}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <div className="flex gap-2">
                <Input
                  value={editForm.author}
                  onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
                  placeholder="Författare"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 flex-1"
                />
                <Input
                  value={editForm.period}
                  onChange={(e) => setEditForm({ ...editForm, period: e.target.value })}
                  placeholder="Period (t.ex. Q1 2026)"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 flex-1"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={saveEdit} disabled={saving} className="bg-white/20 hover:bg-white/30 text-white">
                  <Check className="h-4 w-4 mr-1" /> Spara
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-white/60 hover:text-white hover:bg-white/10">
                  <X className="h-4 w-4 mr-1" /> Avbryt
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="font-heading text-lg text-white font-semibold mb-2">{ceoBlog.title}</h3>
              <p className="text-sm text-white/80 leading-relaxed italic">"{ceoBlog.excerpt}"</p>
              <p className="text-xs text-white/50 mt-4">— {ceoBlog.author}, {ceoBlog.period}</p>
            </>
          )}
        </div>
      )}

      {/* Karriärvägar – only visible to IT group (see .lovable/culture-hidden-sections.md) */}
      {isIT && (
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
            <span className="bg-[hsl(var(--sidebar-background))] text-white text-xs px-3 py-1 rounded-full">Chef</span>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            "Marit gick från koordinator till avtalsansvarig på 2 år"
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
