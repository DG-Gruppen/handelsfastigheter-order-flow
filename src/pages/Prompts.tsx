import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useModuleAccess } from "@/hooks/useModules";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Search, Sparkles, Copy, Star, Pencil, Trash2, MessageSquarePlus, ArrowUpRight } from "lucide-react";
import { PROMPT_CATEGORIES, CATEGORY_BADGE } from "@/lib/promptVariables";
import { PromptEditorDialog } from "@/components/prompts/PromptEditorDialog";
import { PromptUseDialog } from "@/components/prompts/PromptUseDialog";
import { PromptSuggestDialog } from "@/components/prompts/PromptSuggestDialog";

interface PromptRow {
  id: string;
  title: string;
  description: string;
  body: string;
  category: string;
  variables: string[];
  copy_count: number;
  author_id: string;
  created_at: string;
  updated_at: string;
}

interface RatingRow {
  prompt_id: string;
  user_id: string;
  rating: number;
}

interface ProfileLite { id: string; full_name: string | null; }

const ALL = "Alla" as const;

async function fetchData(userId: string) {
  const [pRes, rRes, profRes] = await Promise.all([
    supabase.from("prompts" as any).select("*").order("created_at", { ascending: false }),
    supabase.from("prompt_ratings" as any).select("prompt_id, user_id, rating"),
    supabase.from("profiles").select("id, full_name"),
  ]);
  if (pRes.error) throw pRes.error;
  return {
    prompts: ((pRes.data as unknown) as PromptRow[]) ?? [],
    ratings: ((rRes.data as unknown) as RatingRow[]) ?? [],
    profiles: ((profRes.data as unknown) as ProfileLite[]) ?? [],
  };
}

export default function Prompts() {
  const hasAccess = useModuleAccess("/prompts");
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>(ALL);
  const [sortBy, setSortBy] = useState<"recent" | "rating" | "popular">("recent");
  const [editing, setEditing] = useState<PromptRow | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [useDialog, setUseDialog] = useState<PromptRow | null>(null);
  const [suggestDialog, setSuggestDialog] = useState<PromptRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["prompts-data", user?.id],
    queryFn: () => fetchData(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("prompts-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "prompts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["prompts-data", user.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "prompt_ratings" }, () => {
        queryClient.invalidateQueries({ queryKey: ["prompts-data", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, queryClient]);

  const prompts = data?.prompts ?? [];
  const ratings = data?.ratings ?? [];
  const profiles = data?.profiles ?? [];

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, p.full_name ?? "Okänd"));
    return m;
  }, [profiles]);

  const ratingMap = useMemo(() => {
    const m = new Map<string, { sum: number; count: number; mine?: number }>();
    ratings.forEach((r) => {
      const cur = m.get(r.prompt_id) ?? { sum: 0, count: 0 };
      cur.sum += r.rating;
      cur.count += 1;
      if (r.user_id === user?.id) cur.mine = r.rating;
      m.set(r.prompt_id, cur);
    });
    return m;
  }, [ratings, user?.id]);

  const filtered = useMemo(() => {
    let list = prompts;
    if (activeCat !== ALL) list = list.filter((p) => p.category === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.body.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    list = [...list];
    if (sortBy === "rating") {
      list.sort((a, b) => {
        const ra = ratingMap.get(a.id);
        const rb = ratingMap.get(b.id);
        const aa = ra && ra.count ? ra.sum / ra.count : 0;
        const bb = rb && rb.count ? rb.sum / rb.count : 0;
        return bb - aa;
      });
    } else if (sortBy === "popular") {
      list.sort((a, b) => b.copy_count - a.copy_count);
    }
    return list;
  }, [prompts, activeCat, search, sortBy, ratingMap]);

  const handleRate = async (promptId: string, rating: number) => {
    if (!user) return;
    const existing = ratingMap.get(promptId)?.mine;
    const next = existing === rating ? 0 : rating;
    if (next === 0) {
      const { error } = await supabase
        .from("prompt_ratings" as any)
        .delete()
        .eq("prompt_id", promptId)
        .eq("user_id", user.id);
      if (error) toast.error("Kunde inte ta bort betyget");
    } else {
      const { error } = await supabase
        .from("prompt_ratings" as any)
        .upsert({ prompt_id: promptId, user_id: user.id, rating: next }, { onConflict: "prompt_id,user_id" });
      if (error) toast.error("Kunde inte spara betyget");
    }
    queryClient.invalidateQueries({ queryKey: ["prompts-data", user.id] });
  };

  const handleDelete = async (p: PromptRow) => {
    if (!confirm(`Radera "${p.title}"?`)) return;
    const { error } = await supabase.from("prompts" as any).delete().eq("id", p.id);
    if (error) toast.error("Kunde inte radera");
    else {
      toast.success("Prompt raderad");
      queryClient.invalidateQueries({ queryKey: ["prompts-data", user?.id] });
    }
  };

  if (!hasAccess) return <Navigate to="/dashboard" replace />;

  const tabs = [ALL, ...PROMPT_CATEGORIES] as string[];

  return (
    <div className="container max-w-6xl px-4 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Prompt-bibliotek
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Spara och dela AI-prompts med kollegorna. Använd <code className="px-1 py-0.5 bg-muted rounded">{`{{variabler}}`}</code> för dynamiska fält.
          </p>
        </div>
      </div>

      {/* Search + add */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök på prompt, nyckelord..."
            className="pl-10 h-11"
          />
        </div>
        <Button onClick={() => { setEditing(null); setCreatorOpen(true); }} className="h-11">
          <Plus className="h-4 w-4 mr-1" /> Lägg till prompt
        </Button>
      </div>

      {/* Tabs + sort */}
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveCat(t)}
            className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
              activeCat === t
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-muted"
            }`}
          >
            {t}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 text-xs">
          <span className="text-muted-foreground mr-1">Sortera:</span>
          {([
            ["recent", "Senaste"],
            ["rating", "Topprankade"],
            ["popular", "Mest använda"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSortBy(k)}
              className={`px-2 py-1 rounded ${sortBy === k ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Laddar...</p>}

      {!isLoading && filtered.length === 0 && (
        <Card className="p-8 text-center">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {prompts.length === 0
              ? "Inga prompts ännu. Var först med att lägga till en!"
              : "Inga prompts matchar din sökning."}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((p) => {
          const r = ratingMap.get(p.id);
          const avg = r && r.count ? r.sum / r.count : 0;
          const myRating = r?.mine ?? 0;
          const canEdit = isAdmin || p.author_id === user?.id;
          const authorName = profileMap.get(p.author_id) ?? "Okänd";
          const initials = authorName.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("");
          return (
            <Card key={p.id} className="p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-foreground leading-tight">{p.title}</h3>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_BADGE[p.category] ?? CATEGORY_BADGE["Övrigt"]}`}>
                  {p.category}
                </span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>

              <div className="flex items-center justify-between mt-auto pt-2 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium shrink-0">
                    {initials || "?"}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-foreground truncate">{authorName}</div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => handleRate(p.id, n)}
                          aria-label={`Sätt betyg ${n}`}
                          className="p-0.5"
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${
                              n <= (myRating || Math.round(avg))
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground/40"
                            }`}
                          />
                        </button>
                      ))}
                      {r && r.count > 0 && (
                        <span className="text-[11px] text-muted-foreground ml-1">
                          {avg.toFixed(1)} ({r.count})
                        </span>
                      )}
                      {p.copy_count > 0 && (
                        <span className="text-[11px] text-muted-foreground ml-2">· {p.copy_count} kopior</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canEdit ? (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setCreatorOpen(true); }} title="Redigera">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(p)} title="Radera">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  ) : (
                    <Button size="icon" variant="ghost" onClick={() => setSuggestDialog(p)} title="Föreslå ändring">
                      <MessageSquarePlus className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setUseDialog(p)}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Kopiera
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <PromptEditorDialog
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        prompt={editing}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["prompts-data", user?.id] })}
      />
      <PromptUseDialog
        prompt={useDialog}
        onOpenChange={(open) => !open && setUseDialog(null)}
        onCopied={() => queryClient.invalidateQueries({ queryKey: ["prompts-data", user?.id] })}
      />
      <PromptSuggestDialog
        prompt={suggestDialog}
        onOpenChange={(open) => !open && setSuggestDialog(null)}
      />
    </div>
  );
}
