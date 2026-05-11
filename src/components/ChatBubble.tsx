import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { MessageSquare, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const Chat = lazy(() => import("@/pages/Chat"));

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const { user, profile } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    supabase
      .from("org_chart_settings")
      .select("setting_value")
      .eq("setting_key", "chat_enabled")
      .maybeSingle()
      .then(({ data }) => {
        setEnabled(data?.setting_value !== "false");
      });
  }, []);

  // Fetch total unread count across all channels
  const { data: totalUnread = 0 } = useQuery({
    queryKey: ["chat-bubble-unread", user?.id],
    queryFn: async () => {
      if (!user) return 0;

      // Get user's channel memberships
      const { data: memberships } = await supabase
        .from("chat_channel_members")
        .select("channel_id")
        .eq("user_id", user.id);
      if (!memberships || memberships.length === 0) return 0;

      // Get read statuses
      const { data: readStatuses } = await supabase
        .from("chat_read_status")
        .select("channel_id, last_read_at")
        .eq("user_id", user.id);

      const readMap = new Map<string, string>();
      readStatuses?.forEach((rs) => readMap.set(rs.channel_id, rs.last_read_at));

      // Count unread messages per channel
      let total = 0;
      for (const m of memberships) {
        const lastRead = readMap.get(m.channel_id);
        let query = supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", m.channel_id)
          .is("parent_message_id", null)
          .neq("user_id", user.id);
        if (lastRead) {
          query = query.gt("created_at", lastRead);
        }
        const { count } = await query;
        total += count || 0;
      }
      return total;
    },
    enabled: !!user && !open,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Subscribe to new messages for real-time badge updates
  useEffect(() => {
    if (!user || open) return;
    const channel = supabase
      .channel("chat-bubble-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => {
          // Invalidate will be handled by queryClient in the parent
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, open]);

  const handleClose = useCallback(() => setOpen(false), []);

  if (!enabled || !user || profile?.is_external) return null;

  return (
    <>
      {/* Floating button with unread badge */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-8 md:right-12 z-50 h-10 w-10 md:h-11 md:w-11 rounded-full gradient-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
          aria-label="Öppna chatt"
        >
          <MessageSquare className="h-4 w-4 md:h-5 md:w-5" />
          {totalUnread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1 shadow-sm">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      )}

      {/* Chat panel — no extra header, Chat component has its own */}
      {open && (
        <div
          className="fixed bottom-20 md:bottom-6 right-4 z-50 rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
          style={{
            width: "min(calc(100vw - 2rem), 700px)",
            height: "min(80vh, 640px)",
          }}
        >
          <div className="flex-1 min-h-0">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              }
            >
              <Chat embedded onClose={handleClose} />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
}
