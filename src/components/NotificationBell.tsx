import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, FileText, BookOpen, Video, ShoppingCart, CheckCircle2,
  XCircle, Package, Truck, Info, Archive, ChevronDown, ChevronUp,
  UserCheck, MessageSquare,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string; route: (refId: string | null) => string | null }> = {
  order_approved: { icon: CheckCircle2, color: "text-emerald-500", route: (id) => id ? `/orders/${id}` : "/history" },
  order_rejected: { icon: XCircle, color: "text-destructive", route: (id) => id ? `/orders/${id}` : "/history" },
  order_delivered: { icon: Truck, color: "text-primary", route: (id) => id ? `/orders/${id}` : "/history" },
  order_pending: { icon: ShoppingCart, color: "text-amber-500", route: (id) => id ? `/orders/${id}` : "/history" },
  document_new: { icon: FileText, color: "text-sky-500", route: () => "/documents" },
  kb_article: { icon: BookOpen, color: "text-violet-500", route: () => "/kunskapsbanken" },
  kb_video: { icon: Video, color: "text-rose-500", route: () => "/kunskapsbanken" },
  info: { icon: Info, color: "text-muted-foreground", route: () => null },
  planner_assigned: { icon: UserCheck, color: "text-indigo-500", route: () => "/planner" },
  planner_comment: { icon: MessageSquare, color: "text-teal-500", route: () => "/planner" },
};

const defaultConfig = typeConfig.info;

async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as Notification[]) ?? [];
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const unread = useMemo(() => notifications.filter((n) => !n.is_read), [notifications]);
  const archived = useMemo(() => notifications.filter((n) => n.is_read), [notifications]);
  const unreadCount = unread.length;

  // Realtime subscription — optimistically add new notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-bell")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.setQueryData<Notification[]>(["notifications", user.id], (old) =>
            [payload.new as Notification, ...(old ?? [])].slice(0, 50)
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const setNotificationsOptimistic = useCallback(
    (updater: (prev: Notification[]) => Notification[]) => {
      if (!user) return;
      queryClient.setQueryData<Notification[]>(["notifications", user.id], (old) => updater(old ?? []));
    },
    [user?.id, queryClient]
  );

  const markAsRead = async (id: string) => {
    setNotificationsOptimistic((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from("notifications").update({ is_read: true } as any).eq("id", id);
  };

  const markAllRead = async () => {
    if (!user || unread.length === 0) return;
    const unreadIds = unread.map((n) => n.id);
    setNotificationsOptimistic((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true } as any).in("id", unreadIds);
  };

  const handleClick = (notification: Notification) => {
    if (!notification.is_read) markAsRead(notification.id);
    const config = typeConfig[notification.type] || defaultConfig;
    const route = config.route(notification.reference_id);
    if (route) {
      navigate(route);
      setOpen(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just nu";
    if (diffMin < 60) return `${diffMin} min sedan`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h sedan`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d sedan`;
    return date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
  };

  const renderNotification = (n: Notification) => {
    const config = typeConfig[n.type] || defaultConfig;
    const TypeIcon = config.icon;
    return (
      <button
        key={n.id}
        onClick={() => handleClick(n)}
        className={cn(
          "w-full text-left px-4 py-3 hover:bg-secondary/40 transition-colors",
          !n.is_read && "bg-primary/5"
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5 shrink-0", config.color)}>
            <TypeIcon className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={cn("text-sm text-foreground truncate", !n.is_read && "font-semibold")}>
                {n.title}
              </p>
              {!n.is_read && (
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
              )}
            </div>
            {n.message && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
            )}
            <p className="text-[10px] text-muted-foreground/70 mt-1">{formatTime(n.created_at)}</p>
          </div>
        </div>
      </button>
    );
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setShowArchive(false); }}>
      <PopoverTrigger asChild>
        <button className="relative flex items-center justify-center h-10 w-10 rounded-full hover:bg-secondary/60 transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold shadow-sm animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0 glass-surface" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <h3 className="text-sm font-semibold text-foreground">Notiser</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              Markera alla som lästa
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[420px] overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: "touch" }}>
          {unread.length === 0 && archived.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Inga notiser ännu</p>
            </div>
          ) : (
            <>
              {unread.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-xs text-muted-foreground">Inga nya notiser</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {unread.slice(0, 5).map(renderNotification)}
                  {unread.length > 5 && (
                    <div className="px-4 py-2 text-center">
                      <p className="text-xs text-muted-foreground">
                        +{unread.length - 5} olästa till
                      </p>
                    </div>
                  )}
                </div>
              )}

              {archived.length > 0 && (
                <>
                  <Separator />
                  <button
                    onClick={() => setShowArchive((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Archive className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Arkiv ({archived.length})</span>
                    </div>
                    {showArchive ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                  {showArchive && (
                    <div className="divide-y divide-border/50 bg-muted/20">
                      {archived.map(renderNotification)}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
