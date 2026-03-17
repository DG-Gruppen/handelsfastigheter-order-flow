import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";

interface Comment {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string;
}

interface Props {
  cardId: string;
  profiles: Profile[];
}

export default function CardComments({ cardId, profiles }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));

  const fetchComments = async () => {
    const { data } = await supabase
      .from("planner_card_comments")
      .select("*")
      .eq("card_id", cardId)
      .order("created_at", { ascending: true });
    setComments((data as Comment[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`card-comments-${cardId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "planner_card_comments",
        filter: `card_id=eq.${cardId}`,
      }, () => {
        fetchComments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [cardId]);

  useEffect(() => {
    if (comments.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments.length]);

  const handleSubmit = async () => {
    const content = newComment.trim();
    if (!content || !user) return;

    const { error } = await supabase
      .from("planner_card_comments")
      .insert({ card_id: cardId, user_id: user.id, content });

    if (error) {
      toast.error("Kunde inte skicka kommentar");
      return;
    }
    setNewComment("");
  };

  const handleDelete = async (id: string) => {
    await supabase.from("planner_card_comments" as any).delete().eq("id", id);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <MessageSquare className="h-4 w-4" />
        <span>Laddar kommentarer...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MessageSquare className="h-4 w-4" />
        Kommentarer ({comments.length})
      </div>

      {comments.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
          {comments.map(c => (
            <div key={c.id} className="group rounded-lg bg-muted/50 p-2.5 text-sm">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-medium text-foreground text-xs">
                  {profileMap.get(c.user_id) ?? "Okänd"}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: sv })}
                  </span>
                  {user && (user.id === c.user_id) && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-foreground/80 whitespace-pre-wrap break-words">{c.content}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Skriv en kommentar..."
          rows={2}
          className="flex-1 resize-none text-sm"
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!newComment.trim()}
          className="self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Ctrl+Enter för att skicka</p>
    </div>
  );
}
