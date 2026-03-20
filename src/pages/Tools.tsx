import { ExternalLink, Star } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Tool {
  id: string;
  name: string;
  description: string;
  emoji: string;
  url: string;
  sort_order: number;
}

const MAX_FAVORITES = 8;

export default function Tools() {
  const { user } = useAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [toolsRes, favsRes] = await Promise.all([
      supabase.from("tools" as any).select("*").eq("is_active", true).order("name"),
      user
        ? supabase.from("user_tool_favorites" as any).select("tool_id").eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
    ]);
    setTools(((toolsRes.data as unknown) as Tool[]) ?? []);
    setFavoriteIds(new Set(((favsRes.data as any[]) ?? []).map((f: any) => f.tool_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleFavorite = async (toolId: string) => {
    if (!user) return;
    const isFav = favoriteIds.has(toolId);

    if (!isFav && favoriteIds.size >= MAX_FAVORITES) {
      toast.error(`Max ${MAX_FAVORITES} favoriter. Ta bort en först.`);
      return;
    }

    // Optimistic update
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(toolId); else next.add(toolId);
      return next;
    });

    if (isFav) {
      await supabase.from("user_tool_favorites" as any).delete().eq("user_id", user.id).eq("tool_id", toolId);
    } else {
      await supabase.from("user_tool_favorites" as any).insert({
        user_id: user.id,
        tool_id: toolId,
        sort_order: favoriteIds.size,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Verktyg</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Snabbåtkomst till alla system och tjänster.{" "}
          <span className="text-primary font-medium">
            ★ {favoriteIds.size}/{MAX_FAVORITES} favoriter
          </span>{" "}
          — dina favoriter visas på startsidan.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const isFav = favoriteIds.has(tool.id);
          return (
            <div
              key={tool.id}
              className="bg-card rounded-lg border border-border p-5 hover:border-primary/30 transition-colors group flex items-start gap-4 relative"
            >
              <a
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-4 flex-1 min-w-0"
              >
                <span className="text-3xl">{tool.emoji}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{tool.name}</h3>
                  <p className="text-xs text-muted-foreground">{tool.description}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
              </a>
              <button
                onClick={() => toggleFavorite(tool.id)}
                className="shrink-0 p-1.5 rounded-md hover:bg-secondary transition-colors"
                title={isFav ? "Ta bort favorit" : "Lägg till som favorit"}
              >
                <Star className={`h-5 w-5 transition-colors ${isFav ? "fill-warning text-warning" : "text-muted-foreground/30 hover:text-muted-foreground"}`} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
