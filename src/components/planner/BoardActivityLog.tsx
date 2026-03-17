import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, ArrowRightLeft, Columns, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityEntry {
  id: string;
  board_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string;
}

interface Props {
  boardId: string;
  profiles: Profile[];
}

const ACTION_CONFIG: Record<string, { icon: typeof Plus; label: string; color: string }> = {
  created: { icon: Plus, label: "skapade", color: "text-green-600" },
  updated: { icon: Pencil, label: "uppdaterade", color: "text-blue-600" },
  deleted: { icon: Trash2, label: "tog bort", color: "text-destructive" },
  moved: { icon: ArrowRightLeft, label: "flyttade", color: "text-amber-600" },
};

const ENTITY_LABELS: Record<string, string> = {
  card: "kort",
  column: "kolumn",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just nu";
  if (mins < 60) return `${mins} min sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} tim sedan`;
  const days = Math.floor(hours / 24);
  return `${days} dag${days > 1 ? "ar" : ""} sedan`;
}

export default function BoardActivityLog({ boardId, profiles }: Props) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("planner_activity_log")
        .select("*")
        .eq("board_id", boardId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!cancelled) {
        setEntries((data as ActivityEntry[]) ?? []);
        setLoading(false);
      }
    };

    fetch();

    const channel = supabase
      .channel(`planner-activity-${boardId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "planner_activity_log", filter: `board_id=eq.${boardId}` },
        (payload) => {
          setEntries(prev => [payload.new as ActivityEntry, ...prev].slice(0, 50));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [boardId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">Ingen aktivitet ännu</p>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-3">
      <div className="space-y-3">
        {entries.map(entry => {
          const config = ACTION_CONFIG[entry.action] ?? ACTION_CONFIG.updated;
          const Icon = entry.entity_type === "column" ? Columns : CreditCard;
          const userName = profileMap.get(entry.user_id) ?? "Okänd";
          const entityLabel = ENTITY_LABELS[entry.entity_type] ?? entry.entity_type;
          const meta = entry.metadata as Record<string, string> | null;

          return (
            <div key={entry.id} className="flex gap-3 items-start group">
              <div className={cn("mt-0.5 p-1.5 rounded-lg bg-muted/60 shrink-0", config.color)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">
                  <span className="font-medium">{userName}</span>{" "}
                  <span className="text-muted-foreground">{config.label}</span>{" "}
                  <span className="text-muted-foreground">{entityLabel}</span>
                  {entry.entity_name && (
                    <>
                      {" "}
                      <span className="font-medium">"{entry.entity_name}"</span>
                    </>
                  )}
                  {entry.action === "moved" && meta?.from_column && meta?.to_column && (
                    <span className="text-muted-foreground">
                      {" "}från <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{meta.from_column}</Badge>
                      {" "}till <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{meta.to_column}</Badge>
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">{timeAgo(entry.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
