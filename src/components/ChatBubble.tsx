import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FloatingWindow } from "@/components/chat/FloatingWindow";

const Chat = lazy(() => import("@/pages/Chat"));

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const { user, profile } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const qc = useQueryClient();

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

      // Count unread messages per channel (HEAD requests, run in parallel)
      const counts = await Promise.all(
        memberships.map(async (m) => {
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
          return count || 0;
        })
      );
      return counts.reduce((sum, c) => sum + c, 0);
    },
    enabled: !!user && !open,
    refetchInterval: 60000, // Fallback poll; realtime below keeps it fresh
  });

  // Subscribe to new messages for real-time badge updates
  useEffect(() => {
    if (!user || open) return;
    const channel = supabase
      .channel("chat-bubble-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload: { new?: { user_id?: string } }) => {
          if (payload.new?.user_id === user.id) return;
          qc.invalidateQueries({ queryKey: ["chat-bubble-unread"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, open, qc]);

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

      {/* Draggable, resizable chat window */}
      {open && (
        <FloatingWindow
          title="SHF Chatt"
          icon={<MessageSquare className="h-4 w-4 text-primary" />}
          onClose={handleClose}
        >
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            }
          >
            <Chat embedded />
          </Suspense>
        </FloatingWindow>
      )}
    </>
  );
}
