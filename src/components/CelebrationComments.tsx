import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Comment {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
  author_name: string;
}

/** Standalone toggle button – render wherever you want in the card */
export function CelebrationCommentToggle({
  count,
  open,
  onToggle,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-center w-10 h-10 md:w-9 md:h-9 rounded-full hover:bg-accent/20 transition-colors shrink-0"
      aria-label="Kommentera"
    >
      <div className="relative">
        <MessageCircle className={`w-5 h-5 ${open ? "text-primary" : "text-muted-foreground"}`} />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {count}
          </span>
        )}
      </div>
    </button>
  );
}

/** The expandable comment list + input */
export default function CelebrationComments({ weekKey, open, onCountChange }: { weekKey: string; open: boolean; onCountChange?: (count: number) => void }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from("celebration_comments" as any)
      .select("id, message, created_at, user_id")
      .eq("week_key", weekKey)
      .order("created_at", { ascending: true });

    if (!data || (data as any[]).length === 0) {
      setComments([]);
      onCountChange?.(0);
      return;
    }

    const userIds = [...new Set((data as any[]).map((c: any) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    const nameMap: Record<string, string> = {};
    for (const p of (profiles ?? []) as any[]) nameMap[p.user_id] = p.full_name;

    setComments(
      (data as any[]).map((c: any) => ({
        id: c.id,
        message: c.message,
        created_at: c.created_at,
        user_id: c.user_id,
        author_name: nameMap[c.user_id] || "Okänd",
      }))
    );
  }, [weekKey]);

  useEffect(() => {
    if (open) fetchComments();
  }, [open, fetchComments]);

  const handleSend = async () => {
    if (!newMsg.trim() || !user) return;
    setSending(true);
    await supabase.from("celebration_comments" as any).insert({
      week_key: weekKey,
      user_id: user.id,
      message: newMsg.trim(),
    } as any);
    setNewMsg("");
    setSending(false);
    fetchComments();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("celebration_comments" as any).delete().eq("id", id);
    fetchComments();
  };

  if (!open) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
      {comments.length > 0 && (
        <ScrollArea className="max-h-32">
          <div className="space-y-1.5 pr-2">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 group">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-foreground">{c.author_name}</span>
                  <span className="text-[10px] text-muted-foreground/60 ml-1.5">
                    {format(new Date(c.created_at), "d MMM HH:mm", { locale: sv })}
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.message}</p>
                </div>
                {user && c.user_id === user.id && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <div className="flex gap-2">
        <input
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Skriv en hälsning..."
          className="flex-1 h-10 md:h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSend}
          disabled={sending || !newMsg.trim()}
          className="h-10 w-10 md:h-9 md:w-9 shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
