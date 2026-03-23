import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
        <span
          className={`absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center transition-opacity duration-200 ${count > 0 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          {count}
        </span>
      </div>
    </button>
  );
}

/** The comment modal dialog */
export default function CelebrationComments({
  weekKey,
  celebrationName,
  celebrationEmoji,
  open,
  onOpenChange,
  onCountChange,
}: {
  weekKey: string;
  celebrationName?: string;
  celebrationEmoji?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCountChange?: (count: number) => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  const fetchComments = useCallback(async (retries = 2) => {
    const { data, error } = await supabase
      .from("celebration_comments" as any)
      .select("id, message, created_at, user_id")
      .eq("week_key", weekKey)
      .order("created_at", { ascending: true });

    if (error && retries > 0) {
      setTimeout(() => fetchComments(retries - 1), 1500);
      return;
    }

    if (!data || (data as any[]).length === 0) {
      setComments([]);
      onCountChangeRef.current?.(0);
      return;
    }

    const userIds = [...new Set((data as any[]).map((c: any) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    const nameMap: Record<string, string> = {};
    for (const p of (profiles ?? []) as any[]) nameMap[p.user_id] = p.full_name;

    const mapped = (data as any[]).map((c: any) => ({
      id: c.id,
      message: c.message,
      created_at: c.created_at,
      user_id: c.user_id,
      author_name: nameMap[c.user_id] || "Okänd",
    }));
    setComments(mapped);
    onCountChangeRef.current?.(mapped.length);
  }, [weekKey]);

  // Fetch count on mount, full data when open
  useEffect(() => {
    if (open) {
      fetchComments();
    } else {
      supabase
        .from("celebration_comments" as any)
        .select("id", { count: "exact", head: true })
        .eq("week_key", weekKey)
        .then(({ count }) => onCountChangeRef.current?.(count ?? 0));
    }
  }, [open, fetchComments, weekKey]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {celebrationEmoji && <span className="text-xl">{celebrationEmoji}</span>}
            Hälsningar{celebrationName ? ` till ${celebrationName}` : ""}
          </DialogTitle>
          <DialogDescription>Skriv en hälsning eller gratulation!</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {comments.length > 0 && (
            <div
              className="h-[38vh] sm:h-60 overflow-y-auto overscroll-contain pr-1 scrollbar-hide touch-pan-y"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="space-y-3 pr-1">
                {comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-medium text-foreground">{c.author_name}</span>
                        <span className="text-[11px] text-muted-foreground/60">
                          {format(new Date(c.created_at), "d MMM HH:mm", { locale: sv })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{c.message}</p>
                    </div>
                    {user && c.user_id === user.id && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive mt-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Inga hälsningar ännu – var först!</p>
          )}

          <div className="flex gap-2">
            <input
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Skriv en hälsning..."
              className="flex-1 h-11 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSend}
              disabled={sending || !newMsg.trim()}
              className="h-11 w-11 shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
