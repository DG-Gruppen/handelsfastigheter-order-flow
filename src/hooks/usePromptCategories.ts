import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PromptCategory {
  id: string;
  name: string;
  badge_class: string;
  sort_order: number;
  is_active: boolean;
}

const FALLBACK_BADGE = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";

export function usePromptCategories() {
  const query = useQuery({
    queryKey: ["prompt-categories"],
    queryFn: async (): Promise<PromptCategory[]> => {
      const { data, error } = await supabase
        .from("prompt_categories" as any)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data as unknown) as PromptCategory[]) ?? [];
    },
    staleTime: 60_000,
  });

  const active = (query.data ?? []).filter((c) => c.is_active);
  const names = active.map((c) => c.name);
  const badgeMap: Record<string, string> = {};
  (query.data ?? []).forEach((c) => { badgeMap[c.name] = c.badge_class || FALLBACK_BADGE; });

  return { ...query, categories: query.data ?? [], activeNames: names, badgeMap, fallbackBadge: FALLBACK_BADGE };
}
