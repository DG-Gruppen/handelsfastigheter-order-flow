import { ExternalLink, Star, User, Building2, Info } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Tool {
  id: string;
  name: string;
  description: string;
  emoji: string;
  url: string;
  sort_order: number;
  owner_id: string;
  owner_names: string[];
  department_names: string[];
}

const MAX_FAVORITES = 8;

async function fetchToolsData(userId: string | undefined) {
  const [toolsRes, favsRes, ownersRes, profilesRes, toolDeptRes, deptRes] = await Promise.all([
    supabase.from("tools" as any).select("*").eq("is_active", true).order("name"),
    userId
      ? supabase.from("user_tool_favorites" as any).select("tool_id").eq("user_id", userId)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("tool_owners" as any).select("tool_id, profile_id"),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("tool_departments" as any).select("tool_id, department_id"),
    supabase.from("departments").select("id, name"),
  ]);

  const profMap = new Map<string, string>();
  for (const p of (profilesRes.data ?? []) as { id: string; full_name: string | null }[]) {
    if (p.full_name) profMap.set(p.id, p.full_name);
  }
  const ownersByTool = new Map<string, string[]>();
  for (const link of ((ownersRes.data ?? []) as unknown) as { tool_id: string; profile_id: string }[]) {
    const name = profMap.get(link.profile_id);
    if (!name) continue;
    const arr = ownersByTool.get(link.tool_id) ?? [];
    arr.push(name);
    ownersByTool.set(link.tool_id, arr);
  }

  const deptMap = new Map<string, string>();
  for (const d of ((deptRes.data ?? []) as { id: string; name: string }[])) {
    deptMap.set(d.id, d.name);
  }
  const deptsByTool = new Map<string, string[]>();
  for (const link of ((toolDeptRes.data ?? []) as unknown) as { tool_id: string; department_id: string }[]) {
    const name = deptMap.get(link.department_id);
    if (!name) continue;
    const arr = deptsByTool.get(link.tool_id) ?? [];
    arr.push(name);
    deptsByTool.set(link.tool_id, arr);
  }

  const rawTools = ((toolsRes.data ?? []) as unknown) as Tool[];
  const tools = rawTools.map(t => ({
    ...t,
    owner_names: (ownersByTool.get(t.id) ?? (t.owner_id && profMap.has(t.owner_id) ? [profMap.get(t.owner_id)!] : []))
      .slice()
      .sort((a, b) => a.localeCompare(b, "sv")),
    department_names: (deptsByTool.get(t.id) ?? []).slice().sort((a, b) => a.localeCompare(b, "sv")),
  }));

  return {
    tools,
    favoriteIds: new Set(((favsRes.data as any[]) ?? []).map((f: any) => f.tool_id)) as Set<string>,
  };
}


export default function Tools() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [optimisticFavs, setOptimisticFavs] = useState<Set<string> | null>(null);

  const { data, isLoading: loading } = useQuery({
    queryKey: ["tools-data", user?.id],
    queryFn: () => fetchToolsData(user?.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const tools = data?.tools ?? [];
  const favoriteIds = optimisticFavs ?? data?.favoriteIds ?? new Set<string>();

  const toggleFavorite = async (toolId: string) => {
    if (!user) return;
    const isFav = favoriteIds.has(toolId);

    if (!isFav && favoriteIds.size >= MAX_FAVORITES) {
      toast.error(`Max ${MAX_FAVORITES} favoriter. Ta bort en först.`);
      return;
    }

    const next = new Set(favoriteIds);
    if (isFav) next.delete(toolId); else next.add(toolId);
    setOptimisticFavs(next);

    if (isFav) {
      await supabase.from("user_tool_favorites" as any).delete().eq("user_id", user.id).eq("tool_id", toolId);
    } else {
      await supabase.from("user_tool_favorites" as any).insert({
        user_id: user.id,
        tool_id: toolId,
        sort_order: favoriteIds.size,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["tools-data"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-quick-tools"] });
    setOptimisticFavs(null);
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
          const owners = tool.owner_names ?? [];
          const depts = tool.department_names ?? [];
          const primaryOwner = owners[0];
          const extraOwners = owners.length - 1;
          const visibleDepts = depts.slice(0, 2);
          const extraDepts = depts.length - visibleDepts.length;

          return (
            <div
              key={tool.id}
              className="bg-card rounded-lg border border-border p-5 hover:border-primary/30 transition-colors group flex flex-col gap-3 relative"
            >
              <div className="flex items-start gap-3">
                <a
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 flex-1 min-w-0"
                >
                  <span className="text-3xl shrink-0">{tool.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-1.5">
                      {tool.name}
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>
                  </div>
                </a>
                <button
                  onClick={() => toggleFavorite(tool.id)}
                  className="shrink-0 p-1.5 rounded-md hover:bg-secondary transition-colors"
                  title={isFav ? "Ta bort favorit" : "Lägg till som favorit"}
                  aria-label={isFav ? "Ta bort favorit" : "Lägg till som favorit"}
                >
                  <Star className={`h-5 w-5 transition-colors ${isFav ? "fill-warning text-warning" : "text-muted-foreground/30 hover:text-muted-foreground"}`} />
                </button>
              </div>

              {(owners.length > 0 || depts.length > 0) && (
                <div className="border-t border-border/60 pt-2.5 space-y-1.5 text-xs">
                  {primaryOwner && (
                    <div className="flex items-center gap-1.5 text-foreground/80 min-w-0">
                      <User className="h-3.5 w-3.5 text-accent shrink-0" />
                      <span className="truncate" title={owners.join(", ")}>
                        <span className="text-muted-foreground">Systemägare:</span>{" "}
                        <span className="font-medium">{primaryOwner}</span>
                      </span>
                      {extraOwners > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                              aria-label="Visa alla systemägare"
                            >
                              +{extraOwners}
                              <Info className="h-2.5 w-2.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-3" align="end">
                            <div className="text-xs font-semibold mb-2 text-foreground">Systemägare</div>
                            <ul className="space-y-1">
                              {owners.map((o) => (
                                <li key={o} className="flex items-center gap-1.5 text-xs">
                                  <User className="h-3 w-3 text-accent shrink-0" />
                                  <span>{o}</span>
                                </li>
                              ))}
                            </ul>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  )}

                  {depts.length > 0 && (
                    <div className="flex items-start gap-1.5 min-w-0">
                      <Building2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                        {visibleDepts.map((d) => (
                          <Badge
                            key={d}
                            variant="secondary"
                            className="text-[10px] font-normal px-1.5 py-0 h-5"
                          >
                            {d}
                          </Badge>
                        ))}
                        {extraDepts > 0 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className="inline-flex items-center text-[10px] font-medium px-1.5 py-0 h-5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                aria-label="Visa alla avdelningar"
                              >
                                +{extraDepts}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-3" align="end">
                              <div className="text-xs font-semibold mb-2 text-foreground">Avdelningar</div>
                              <div className="flex flex-wrap gap-1">
                                {depts.map((d) => (
                                  <Badge key={d} variant="secondary" className="text-[10px] font-normal">
                                    {d}
                                  </Badge>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
