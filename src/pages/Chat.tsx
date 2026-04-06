import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Hash, MessageCircle, Plus, Send, Users, Search, SmilePlus, Reply, Trash2, X, ArrowLeft, UserPlus, UserMinus, Check, CheckCheck, Crown, Smile, MoreVertical, Phone, Video, LogOut, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { format, isToday, isYesterday, isSameDay } from "date-fns";

import { sv } from "date-fns/locale";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

// ─── Types ───
interface Channel {
  id: string;
  name: string;
  description: string;
  type: "group" | "dm";
  icon: string;
  created_by: string;
  is_archived: boolean;
  created_at: string;
}

interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  parent_message_id: string | null;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

// ─── Helpers ───
function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

const NAME_COLORS = [
  "text-rose-600 dark:text-rose-400",
  "text-blue-600 dark:text-blue-400",
  "text-emerald-600 dark:text-emerald-400",
  "text-violet-600 dark:text-violet-400",
  "text-amber-600 dark:text-amber-400",
  "text-cyan-600 dark:text-cyan-400",
  "text-pink-600 dark:text-pink-400",
  "text-teal-600 dark:text-teal-400",
  "text-orange-600 dark:text-orange-400",
  "text-indigo-600 dark:text-indigo-400",
];

function nameColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length];
}

function formatMsgTime(dateStr: string) {
  return format(new Date(dateStr), "HH:mm");
}

function formatDateSeparator(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Idag";
  if (isYesterday(d)) return "Igår";
  return format(d, "d MMMM yyyy", { locale: sv });
}

function formatConversationTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Igår";
  return format(d, "dd/MM/yy");
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🤔", "👀"];

// ─── Main ───
export default function Chat({ embedded, onClose }: { embedded?: boolean; onClose?: () => void } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [search, setSearch] = useState("");
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  // ─── Data fetching ───
  const { data: channels = [] } = useQuery({
    queryKey: ["chat-channels"],
    queryFn: async () => {
      const { data } = await supabase.from("chat_channels").select("*").eq("is_archived", false).order("updated_at", { ascending: false });
      return (data ?? []) as Channel[];
    },
    enabled: !!user,
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ["chat-memberships", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("chat_channel_members").select("channel_id").eq("user_id", user!.id);
      return (data ?? []).map(m => m.channel_id);
    },
    enabled: !!user,
  });

  const { data: channelMembers = [] } = useQuery({
    queryKey: ["chat-channel-members", activeChannelId],
    queryFn: async () => {
      const { data } = await supabase.from("chat_channel_members").select("user_id").eq("channel_id", activeChannelId!);
      return (data ?? []).map(m => m.user_id);
    },
    enabled: !!activeChannelId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["chat-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email");
      return (data ?? []) as Profile[];
    },
    enabled: !!user,
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach(p => m.set(p.user_id, p));
    return m;
  }, [profiles]);

  // Fetch last message for each channel (for sidebar preview)
  const { data: lastMessages = {} } = useQuery({
    queryKey: ["chat-last-messages", channels.map(c => c.id).join(",")],
    queryFn: async () => {
      if (channels.length === 0) return {};
      const result: Record<string, Message> = {};
      // Fetch last message per channel in parallel
      const promises = channels.map(async (ch) => {
        const { data } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("channel_id", ch.id)
          .is("parent_message_id", null)
          .order("created_at", { ascending: false })
          .limit(1);
        if (data && data.length > 0) result[ch.id] = data[0] as Message;
      });
      await Promise.all(promises);
      return result;
    },
    enabled: channels.length > 0,
  });

  const activeChannel = channels.find(c => c.id === activeChannelId);

  const { data: messages = [] } = useQuery({
    queryKey: ["chat-messages", activeChannelId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("channel_id", activeChannelId!)
        .is("parent_message_id", null)
        .order("created_at", { ascending: true });
      return (data ?? []) as Message[];
    },
    enabled: !!activeChannelId,
  });

  const { data: threadMessages = [] } = useQuery({
    queryKey: ["chat-thread", threadParent?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("parent_message_id", threadParent!.id)
        .order("created_at", { ascending: true });
      return (data ?? []) as Message[];
    },
    enabled: !!threadParent,
  });

  const { data: reactions = [] } = useQuery({
    queryKey: ["chat-reactions", activeChannelId],
    queryFn: async () => {
      const msgIds = messages.map(m => m.id);
      if (msgIds.length === 0) return [];
      const { data } = await supabase.from("chat_reactions").select("*").in("message_id", msgIds);
      return (data ?? []) as Reaction[];
    },
    enabled: messages.length > 0,
  });

  const { data: readStatus = [] } = useQuery({
    queryKey: ["chat-read-status", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("chat_read_status").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: allReadStatus = [] } = useQuery({
    queryKey: ["chat-all-read-status", activeChannelId],
    queryFn: async () => {
      const { data } = await supabase.from("chat_read_status").select("user_id, last_read_at").eq("channel_id", activeChannelId!);
      return (data ?? []) as { user_id: string; last_read_at: string }[];
    },
    enabled: !!activeChannelId,
  });

  const readReceipts = useMemo(() => {
    if (!activeChannelId || channelMembers.length === 0) return {};
    const otherMembers = allReadStatus.filter(rs => rs.user_id !== user?.id);
    const receipts: Record<string, "sent" | "read_some" | "read_all"> = {};
    messages.forEach(msg => {
      if (msg.user_id !== user?.id) return;
      if (otherMembers.length === 0) { receipts[msg.id] = "sent"; return; }
      const msgTime = new Date(msg.created_at).getTime();
      const readBy = otherMembers.filter(rs => new Date(rs.last_read_at).getTime() >= msgTime);
      if (readBy.length === 0) receipts[msg.id] = "sent";
      else if (readBy.length >= otherMembers.length) receipts[msg.id] = "read_all";
      else receipts[msg.id] = "read_some";
    });
    return receipts;
  }, [messages, allReadStatus, channelMembers, user?.id, activeChannelId]);

  const { data: replyCounts = {} } = useQuery({
    queryKey: ["chat-reply-counts", activeChannelId, messages.length],
    queryFn: async () => {
      if (messages.length === 0) return {};
      const msgIds = messages.map(m => m.id);
      const { data } = await supabase
        .from("chat_messages")
        .select("parent_message_id")
        .in("parent_message_id", msgIds);
      const counts: Record<string, number> = {};
      (data ?? []).forEach(r => {
        if (r.parent_message_id) counts[r.parent_message_id] = (counts[r.parent_message_id] || 0) + 1;
      });
      return counts;
    },
    enabled: messages.length > 0,
  });

  // Unread counts per channel
  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    channels.forEach(ch => {
      const rs = readStatus.find(r => r.channel_id === ch.id);
      const lastMsg = lastMessages[ch.id];
      if (!lastMsg) { counts[ch.id] = 0; return; }
      if (!rs) { counts[ch.id] = 1; return; } // never read = at least 1
      counts[ch.id] = new Date(lastMsg.created_at) > new Date(rs.last_read_at) ? 1 : 0;
    });
    return counts;
  }, [channels, readStatus, lastMessages]);

  // ─── Realtime ───
  useEffect(() => {
    if (!activeChannelId) return;
    const channel = supabase
      .channel(`chat-${activeChannelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `channel_id=eq.${activeChannelId}` }, () => {
        qc.invalidateQueries({ queryKey: ["chat-messages", activeChannelId] });
        qc.invalidateQueries({ queryKey: ["chat-reply-counts", activeChannelId] });
        qc.invalidateQueries({ queryKey: ["chat-last-messages"] });
        if (threadParent) qc.invalidateQueries({ queryKey: ["chat-thread", threadParent.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reactions" }, () => {
        qc.invalidateQueries({ queryKey: ["chat-reactions", activeChannelId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_read_status", filter: `channel_id=eq.${activeChannelId}` }, () => {
        qc.invalidateQueries({ queryKey: ["chat-all-read-status", activeChannelId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeChannelId, threadParent?.id, qc]);

  // ─── Mutations ───
  const sendMsg = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: string }) => {
      await supabase.from("chat_messages").insert({
        channel_id: activeChannelId!,
        user_id: user!.id,
        content,
        parent_message_id: parentId ?? null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages", activeChannelId] });
      qc.invalidateQueries({ queryKey: ["chat-last-messages"] });
      if (threadParent) qc.invalidateQueries({ queryKey: ["chat-thread", threadParent.id] });
    },
  });

  const deleteMsg = useMutation({
    mutationFn: async (msgId: string) => {
      await supabase.from("chat_messages").delete().eq("id", msgId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages", activeChannelId] });
      qc.invalidateQueries({ queryKey: ["chat-last-messages"] });
      if (threadParent) qc.invalidateQueries({ queryKey: ["chat-thread", threadParent.id] });
    },
  });

  const toggleReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const existing = reactions.find(r => r.message_id === messageId && r.user_id === user!.id && r.emoji === emoji);
      if (existing) {
        await supabase.from("chat_reactions").delete().eq("id", existing.id);
      } else {
        await supabase.from("chat_reactions").insert({ message_id: messageId, user_id: user!.id, emoji });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-reactions", activeChannelId] }),
  });

  const updateReadStatus = useCallback(async (channelId: string) => {
    if (!user) return;
    await supabase.from("chat_read_status").upsert(
      { channel_id: channelId, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: "channel_id,user_id" }
    );
    qc.invalidateQueries({ queryKey: ["chat-read-status"] });
    qc.invalidateQueries({ queryKey: ["chat-all-read-status", channelId] });
  }, [user, qc]);

  useEffect(() => {
    if (activeChannelId) updateReadStatus(activeChannelId);
  }, [activeChannelId, messages.length]);

  // ─── Sorted channels (by last message time) ───
  const sortedChannels = useMemo(() => {
    const s = search.toLowerCase();
    return channels
      .filter(c => memberships.includes(c.id))
      .filter(c => !s || c.name.toLowerCase().includes(s))
      .sort((a, b) => {
        const aTime = lastMessages[a.id]?.created_at || a.created_at;
        const bTime = lastMessages[b.id]?.created_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
  }, [channels, memberships, search, lastMessages]);

  const handleSelectChannel = (id: string) => {
    setActiveChannelId(id);
    setThreadParent(null);
    setMobileShowChat(true);
  };

  // Get display name for channel (for DMs, show other person)
  const getChannelDisplayName = (ch: Channel) => {
    if (ch.type === "dm") {
      const otherMemberId = channelMembers.find(uid => uid !== user?.id) || "";
      const otherProfile = profileMap.get(otherMemberId);
      return otherProfile?.full_name || ch.name;
    }
    return ch.name;
  };

  return (
    <div className={cn(
      "flex rounded-xl border border-border overflow-hidden shadow-lg",
      embedded ? "h-full" : "h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)]"
    )}>
      {/* ─── Mobile layout (no resize) ─── */}
      <div className={cn("w-full flex flex-col bg-card md:hidden", mobileShowChat && "hidden")}>
        <ConversationSidebar
          search={search} setSearch={setSearch}
          sortedChannels={sortedChannels} lastMessages={lastMessages} profileMap={profileMap}
          activeChannelId={activeChannelId} unreadCounts={unreadCounts}
          user={user} handleSelectChannel={handleSelectChannel}
          showNewChannel={showNewChannel} setShowNewChannel={setShowNewChannel}
          showNewDm={showNewDm} setShowNewDm={setShowNewDm}
          profiles={profiles} memberships={memberships} channels={channels} qc={qc}
          onClose={onClose}
        />
      </div>
      <div className={cn("w-full flex flex-col min-w-0 md:hidden", !mobileShowChat && "hidden")}>
        <ChatMainArea
          activeChannel={activeChannel} user={user} channelMembers={channelMembers}
          messages={messages} reactions={reactions} profileMap={profileMap}
          replyCounts={replyCounts as Record<string, number>} readReceipts={readReceipts}
          threadParent={threadParent} threadMessages={threadMessages}
          setThreadParent={setThreadParent} setMobileShowChat={setMobileShowChat}
          sendMsg={sendMsg} deleteMsg={deleteMsg} toggleReaction={toggleReaction}
          activeChannelId={activeChannelId} qc={qc} profiles={profiles}
          onLeaveChannel={() => { setActiveChannelId(null); setThreadParent(null); setMobileShowChat(false); qc.invalidateQueries({ queryKey: ["chat-channels"] }); qc.invalidateQueries({ queryKey: ["chat-memberships"] }); }}
        />
      </div>

      {/* ─── Desktop layout (resizable sidebar) ─── */}
      <div className="hidden md:flex flex-1 min-w-0 h-full">
        <div className="flex flex-col bg-card border-r border-border overflow-hidden" style={{ width: 340, minWidth: 200, maxWidth: '50%', resize: 'horizontal', overflow: 'auto' }}>
          <ConversationSidebar
            search={search} setSearch={setSearch}
            sortedChannels={sortedChannels} lastMessages={lastMessages} profileMap={profileMap}
            activeChannelId={activeChannelId} unreadCounts={unreadCounts}
            user={user} handleSelectChannel={handleSelectChannel}
            showNewChannel={showNewChannel} setShowNewChannel={setShowNewChannel}
            showNewDm={showNewDm} setShowNewDm={setShowNewDm}
            profiles={profiles} memberships={memberships} channels={channels} qc={qc}
            onClose={onClose}
          />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <ChatMainArea
            activeChannel={activeChannel} user={user} channelMembers={channelMembers}
            messages={messages} reactions={reactions} profileMap={profileMap}
            replyCounts={replyCounts as Record<string, number>} readReceipts={readReceipts}
            threadParent={threadParent} threadMessages={threadMessages}
            setThreadParent={setThreadParent} setMobileShowChat={setMobileShowChat}
            sendMsg={sendMsg} deleteMsg={deleteMsg} toggleReaction={toggleReaction}
            activeChannelId={activeChannelId} qc={qc} profiles={profiles}
            onLeaveChannel={() => { setActiveChannelId(null); setThreadParent(null); setMobileShowChat(false); qc.invalidateQueries({ queryKey: ["chat-channels"] }); qc.invalidateQueries({ queryKey: ["chat-memberships"] }); }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Conversation Sidebar (extracted) ───
function ConversationSidebar({ search, setSearch, sortedChannels, lastMessages, profileMap, activeChannelId, unreadCounts, user, handleSelectChannel, showNewChannel, setShowNewChannel, showNewDm, setShowNewDm, profiles, memberships, channels, qc, onClose }: any) {
  return (
    <>
      <div className="h-14 px-4 flex items-center justify-between bg-muted/50 border-b border-border">
        <h2 className="font-semibold text-base">Chatt</h2>
        <div className="flex gap-0.5">
          <NewChannelDialog open={showNewChannel} onOpenChange={setShowNewChannel} userId={user?.id} profiles={profiles} onCreated={() => { qc.invalidateQueries({ queryKey: ["chat-channels"] }); qc.invalidateQueries({ queryKey: ["chat-memberships"] }); setShowNewChannel(false); }} />
          <NewDmDialog open={showNewDm} onOpenChange={setShowNewDm} userId={user?.id} profiles={profiles} memberships={memberships} channels={channels} onSelect={(id: string) => { handleSelectChannel(id); setShowNewDm(false); }} onCreated={(id: string) => { qc.invalidateQueries({ queryKey: ["chat-channels"] }); qc.invalidateQueries({ queryKey: ["chat-memberships"] }); handleSelectChannel(id); setShowNewDm(false); }} />
          {onClose && (
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:bg-muted rounded-md" aria-label="Stäng chatt">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="px-2 py-1.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Sök eller starta en ny chatt" className="pl-9 h-9 text-sm rounded-lg bg-muted/40 border-0 focus-visible:ring-1" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sortedChannels.map((c: any) => {
          const lastMsg = lastMessages[c.id];
          const lastMsgProfile = lastMsg ? profileMap.get(lastMsg.user_id) : null;
          const isActive = c.id === activeChannelId;
          const unread = unreadCounts[c.id] || 0;
          const isDm = c.type === "dm";
          return (
            <button
              key={c.id}
              onClick={() => handleSelectChannel(c.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors border-b border-border/40",
                isActive ? "bg-primary/8" : "hover:bg-muted/50"
              )}
            >
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarFallback className={cn("text-sm font-medium", isDm ? "bg-accent/20 text-accent" : "bg-primary/10 text-primary")}>
                  {isDm ? <MessageCircle className="h-5 w-5" /> : initials(c.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-sm truncate", unread > 0 ? "font-semibold" : "font-medium")}>{c.name}</span>
                  {lastMsg && (
                    <span className={cn("text-[11px] shrink-0", unread > 0 ? "text-accent font-medium" : "text-muted-foreground")}>
                      {formatConversationTime(lastMsg.created_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {lastMsg && lastMsg.user_id === user?.id && (
                    <CheckCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <p className={cn("text-xs truncate", unread > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
                    {lastMsg ? (
                      <>
                        {c.type === "group" && lastMsg.user_id !== user?.id && (
                          <span className={cn("font-medium", nameColor(lastMsg.user_id))}>
                            {lastMsgProfile?.full_name?.split(" ")[0] || ""}:{" "}
                          </span>
                        )}
                        {lastMsg.content.length > 50 ? lastMsg.content.slice(0, 50) + "..." : lastMsg.content}
                      </>
                    ) : (
                      <span className="italic">Inga meddelanden</span>
                    )}
                  </p>
                  {unread > 0 && (
                    <span className="ml-auto shrink-0 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                      {unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {sortedChannels.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Inga konversationer</p>
        )}
      </div>
    </>
  );
}

// ─── Chat Main Area (extracted) ───
function ChatMainArea({ activeChannel, user, channelMembers, messages, reactions, profileMap, replyCounts, readReceipts, threadParent, threadMessages, setThreadParent, setMobileShowChat, sendMsg, deleteMsg, toggleReaction, activeChannelId, qc, profiles, onLeaveChannel }: any) {
  const mentionProfiles = useMemo(() => {
    return profiles.filter((p: Profile) => channelMembers.includes(p.user_id) && p.user_id !== user?.id);
  }, [profiles, channelMembers, user?.id]);
  return (
    <div className="flex-1 flex min-w-0 h-full">
      <div className="flex-1 flex flex-col min-w-0">
        {activeChannel ? (
          <>
            <div className="h-14 px-3 flex items-center gap-3 bg-muted/50 border-b border-border shrink-0">
              <button className="md:hidden p-1" onClick={() => setMobileShowChat(false)}>
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className={cn("text-sm font-medium", activeChannel.type === "dm" ? "bg-accent/20 text-accent" : "bg-primary/10 text-primary")}>
                  {activeChannel.type === "dm" ? <MessageCircle className="h-4 w-4" /> : initials(activeChannel.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm truncate">{activeChannel.name}</h3>
                <p className="text-[11px] text-muted-foreground truncate">
                  {activeChannel.type === "group" ? `${channelMembers.length} medlemmar` : activeChannel.description || ""}
                </p>
              </div>
              {activeChannel.type === "group" && (
                <ChannelMembersManager
                  channelId={activeChannel.id}
                  isCreator={activeChannel.created_by === user?.id}
                  channelCreatedBy={activeChannel.created_by}
                  profiles={profiles}
                  currentMembers={channelMembers}
                  onChanged={() => { qc.invalidateQueries({ queryKey: ["chat-channel-members", activeChannelId] }); qc.invalidateQueries({ queryKey: ["chat-channels"] }); qc.invalidateQueries({ queryKey: ["chat-memberships"] }); }}
                />
              )}
              <ChannelActionMenu
                channel={activeChannel}
                userId={user?.id}
                onLeft={onLeaveChannel}
              />
            </div>
            <div className="flex-1 flex flex-col min-h-0 relative">
              <div className="absolute inset-0" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }} />
              <MessageList
                messages={messages}
                reactions={reactions}
                profileMap={profileMap}
                userId={user?.id}
                replyCounts={replyCounts}
                readReceipts={readReceipts}
                isGroupChat={activeChannel.type === "group"}
                onReply={setThreadParent}
                onReact={(msgId: string, emoji: string) => toggleReaction.mutate({ messageId: msgId, emoji })}
                onDelete={(msgId: string) => deleteMsg.mutate(msgId)}
              />
            </div>
            <ComposeBar onSend={(content: string) => sendMsg.mutate({ content })} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
            <div className="text-center space-y-3 max-w-sm px-4">
              <div className="mx-auto w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-lg">
                <MessageCircle className="h-10 w-10 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-primary font-[var(--font-heading)]">SHF Chatt</h3>
              <p className="text-sm text-muted-foreground">Välj en konversation eller starta en ny chatt</p>
            </div>
          </div>
        )}
      </div>
      {threadParent && (
        <div className="hidden md:flex w-80 border-l border-border flex-col bg-card">
          <div className="h-14 px-4 flex items-center justify-between bg-muted/50 border-b border-border shrink-0">
            <h4 className="font-semibold text-sm">Tråd</h4>
            <button onClick={() => setThreadParent(null)} className="p-1 hover:bg-muted rounded-full">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-3 border-b border-border bg-muted/20">
            <MessageBubble msg={threadParent} profile={profileMap.get(threadParent.user_id)} userId={user?.id} reactions={reactions.filter((r: any) => r.message_id === threadParent.id)} compact isGroupChat={true} onReact={(emoji: string) => toggleReaction.mutate({ messageId: threadParent.id, emoji })} />
          </div>
          <ScrollArea className="flex-1 p-3 space-y-2">
            {threadMessages.map((m: any) => (
              <MessageBubble key={m.id} msg={m} profile={profileMap.get(m.user_id)} userId={user?.id} reactions={[]} compact isGroupChat={true} onDelete={() => deleteMsg.mutate(m.id)} />
            ))}
          </ScrollArea>
          <ComposeBar onSend={(content: string) => sendMsg.mutate({ content, parentId: threadParent.id })} placeholder="Svara i tråd..." />
        </div>
      )}
    </div>
  );
}

// ─── Message List with date separators ───
function MessageList({
  messages, reactions, profileMap, userId, replyCounts, readReceipts, isGroupChat, onReply, onReact, onDelete
}: {
  messages: Message[];
  reactions: Reaction[];
  profileMap: Map<string, Profile>;
  userId?: string;
  replyCounts: Record<string, number>;
  readReceipts: Record<string, "sent" | "read_some" | "read_all">;
  isGroupChat: boolean;
  onReply: (msg: Message) => void;
  onReact: (msgId: string, emoji: string) => void;
  onDelete: (msgId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-2 relative z-10">
      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const sameUser = prev && prev.user_id === msg.user_id;
        const timeDiff = prev ? new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() : Infinity;
        const grouped = sameUser && timeDiff < 2 * 60 * 1000; // 2 min grouping
        const msgReactions = reactions.filter(r => r.message_id === msg.id);
        const replyCount = replyCounts[msg.id] || 0;
        const isOwn = msg.user_id === userId;

        // Date separator
        const showDate = !prev || !isSameDay(new Date(msg.created_at), new Date(prev.created_at));

        return (
          <div key={msg.id}>
            {showDate && (
              <div className="flex items-center justify-center py-3">
                <span className="bg-card/90 backdrop-blur-sm text-muted-foreground text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm border border-border/50">
                  {formatDateSeparator(msg.created_at)}
                </span>
              </div>
            )}
            <div className={cn(
              "flex mb-0.5",
              isOwn ? "justify-end" : "justify-start",
              !grouped && i > 0 && !showDate && "mt-3"
            )}>
              <div className="max-w-[80%] md:max-w-[65%]">
                <MessageBubble
                  msg={msg}
                  profile={profileMap.get(msg.user_id)}
                  userId={userId}
                  reactions={msgReactions}
                  grouped={grouped}
                  replyCount={replyCount}
                  readReceipt={readReceipts[msg.id]}
                  isGroupChat={isGroupChat}
                  onReply={() => onReply(msg)}
                  onReact={(emoji) => onReact(msg.id, emoji)}
                  onDelete={() => onDelete(msg.id)}
                />
              </div>
            </div>
          </div>
        );
      })}
      {messages.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <span className="bg-card/90 backdrop-blur-sm text-muted-foreground text-xs px-4 py-2 rounded-lg shadow-sm border border-border/50">
            Inga meddelanden ännu – skriv det första! 💬
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Message Bubble (WhatsApp style) ───
function MessageBubble({
  msg, profile, userId, reactions = [], grouped, compact, replyCount, readReceipt, isGroupChat, onReply, onReact, onDelete
}: {
  msg: Message;
  profile?: Profile;
  userId?: string;
  reactions?: Reaction[];
  grouped?: boolean;
  compact?: boolean;
  replyCount?: number;
  readReceipt?: "sent" | "read_some" | "read_all";
  isGroupChat?: boolean;
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  onDelete?: () => void;
}) {
  const name = profile?.full_name || "Okänd";
  const isOwn = msg.user_id === userId;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const groupedReactions = useMemo(() => {
    const map = new Map<string, { emoji: string; count: number; hasOwn: boolean }>();
    reactions.forEach(r => {
      const existing = map.get(r.emoji);
      if (existing) {
        existing.count++;
        if (r.user_id === userId) existing.hasOwn = true;
      } else {
        map.set(r.emoji, { emoji: r.emoji, count: 1, hasOwn: r.user_id === userId });
      }
    });
    return Array.from(map.values());
  }, [reactions, userId]);

  // WhatsApp-style bubble with tail
  return (
    <div className="group relative">
      <div className={cn(
        "relative rounded-lg px-2.5 pt-1.5 pb-1 shadow-sm",
        isOwn
          ? "bg-accent/15 dark:bg-accent/20 rounded-tr-none border border-accent/20"
          : "bg-card rounded-tl-none border border-border/50",
        grouped && "rounded-lg",
        compact && "px-2 py-1"
      )}>
        {/* Sender name (group chats only, not own) */}
        {!grouped && !isOwn && isGroupChat && !compact && (
          <p className={cn("text-[12px] font-semibold mb-0.5 leading-tight", nameColor(msg.user_id))}>{name}</p>
        )}

        {/* Message content + inline time */}
        <div className="flex items-end gap-2">
          <div className={cn(
            "prose prose-sm dark:prose-invert max-w-none text-[13.5px] leading-[1.35] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-0",
            isOwn && "dark:prose-invert"
          )}>
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>

          {/* Inline time + read receipt (WhatsApp style) */}
          <span className="inline-flex items-center gap-0.5 shrink-0 self-end translate-y-0.5 ml-1">
            {msg.is_edited && <span className="text-[10px] text-muted-foreground/60 italic mr-0.5">redigerad</span>}
            <span className={cn("text-[10px] leading-none", isOwn ? "text-muted-foreground/60" : "text-muted-foreground/60")}>{formatMsgTime(msg.created_at)}</span>
            {isOwn && readReceipt && (
              readReceipt === "read_all"
                ? <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                : readReceipt === "read_some"
                ? <CheckCheck className="h-3.5 w-3.5 text-muted-foreground/50" />
                : <Check className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
          </span>
        </div>
      </div>

      {/* Hover action bar */}
      <div className={cn(
        "absolute top-0 hidden group-hover:inline-flex bg-card text-foreground border border-border rounded-md shadow-md z-20 -translate-y-1/2",
        isOwn ? "right-1" : "left-1"
      )}>
        {QUICK_EMOJIS.slice(0, 3).map(e => (
          <button key={e} onClick={() => onReact?.(e)} className="px-1.5 py-1 hover:bg-accent text-sm">{e}</button>
        ))}
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <button className="px-1.5 py-1 hover:bg-accent text-foreground"><SmilePlus className="h-3.5 w-3.5" /></button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-0" side="top">
            <Picker data={data} onEmojiSelect={(e: any) => { onReact?.(e.native); setShowEmojiPicker(false); }} theme="auto" previewPosition="none" skinTonePosition="none" />
          </PopoverContent>
        </Popover>
        {onReply && (
          <button onClick={onReply} className="px-1.5 py-1 hover:bg-accent text-foreground"><Reply className="h-3.5 w-3.5" /></button>
        )}
        {isOwn && onDelete && (
          <button onClick={onDelete} className="px-1.5 py-1 hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        )}
      </div>

      {/* Reactions */}
      {groupedReactions.length > 0 && (
        <div className={cn("flex flex-wrap gap-1 mt-0.5", isOwn && "justify-end")}>
          {groupedReactions.map(r => (
            <button
              key={r.emoji}
              onClick={() => onReact?.(r.emoji)}
              className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors shadow-sm",
                r.hasOwn ? "bg-primary/10 border-primary/30" : "bg-card border-border hover:bg-accent"
              )}
            >
              <span>{r.emoji}</span>
              <span className="font-medium">{r.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Thread reply count */}
      {!!replyCount && replyCount > 0 && (
        <button onClick={onReply} className={cn("flex items-center gap-1 mt-0.5 text-[11px] text-primary hover:underline", isOwn && "justify-end")}>
          <Reply className="h-3 w-3" />
          {replyCount} svar
        </button>
      )}
    </div>
  );
}

// ─── Compose Bar (WhatsApp style) ───
function ComposeBar({ onSend, disabled, placeholder }: { onSend: (content: string) => void; disabled?: boolean; placeholder?: string }) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  const handleSend = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  return (
    <div className="bg-muted/50 border-t border-border px-3 py-2 flex items-end gap-2">
      <Popover open={showEmoji} onOpenChange={setShowEmoji}>
        <PopoverTrigger asChild>
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0 self-end">
            <Smile className="h-5 w-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border-0" side="top" align="start">
          <Picker data={data} onEmojiSelect={(e: any) => { setText(prev => prev + e.native); setShowEmoji(false); inputRef.current?.focus(); }} theme="auto" previewPosition="none" skinTonePosition="none" />
        </PopoverContent>
      </Popover>

      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        placeholder={disabled ? "Gå med i gruppen för att skriva..." : (placeholder || "Skriv ett meddelande")}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-lg border-0 bg-card px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground disabled:opacity-50 shadow-sm max-h-28"
        style={{ minHeight: "40px" }}
      />

      <button
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className={cn(
          "p-2.5 rounded-full shrink-0 self-end transition-colors",
          text.trim()
            ? "gradient-primary text-primary-foreground shadow-md hover:opacity-90"
            : "text-muted-foreground"
        )}
      >
        <Send className="h-5 w-5" />
      </button>
    </div>
  );
}

// ─── Dialogs ───

function NewChannelDialog({ open, onOpenChange, userId, profiles, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; userId?: string; profiles: Profile[]; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const { toast } = useToast();

  const toggleMember = (uid: string) => {
    setSelectedMembers(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const filteredProfiles = profiles.filter(p => {
    if (p.user_id === userId) return false;
    if (memberSearch && !p.full_name.toLowerCase().includes(memberSearch.toLowerCase())) return false;
    return true;
  });

  const create = async () => {
    if (!name.trim() || !userId) return;
    const { data: ch, error } = await supabase.from("chat_channels").insert({ name: name.trim(), description: desc.trim(), type: "group", created_by: userId }).select("id").single();
    if (error || !ch) { toast({ title: "Fel", description: error?.message || "Kunde inte skapa grupp", variant: "destructive" }); return; }
    const members = [userId, ...selectedMembers].map(uid => ({ channel_id: ch.id, user_id: uid }));
    await supabase.from("chat_channel_members").insert(members);
    setName(""); setDesc(""); setSelectedMembers([]); setMemberSearch("");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Ny grupp"><Plus className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Skapa grupp</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Gruppnamn" value={name} onChange={e => setName(e.target.value)} />
          <Input placeholder="Beskrivning (valfritt)" value={desc} onChange={e => setDesc(e.target.value)} />
          <div>
            <label className="text-sm font-medium mb-1 block">Bjud in medlemmar</label>
            <Input placeholder="Sök kollega..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} className="mb-2" />
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedMembers.map(uid => {
                  const p = profiles.find(pr => pr.user_id === uid);
                  return (
                    <Badge key={uid} variant="secondary" className="gap-1 cursor-pointer" onClick={() => toggleMember(uid)}>
                      {p?.full_name || "Okänd"}
                      <X className="h-3 w-3" />
                    </Badge>
                  );
                })}
              </div>
            )}
            <ScrollArea className="max-h-40">
              <div className="space-y-0.5">
                {filteredProfiles.map(p => (
                  <button key={p.user_id} onClick={() => toggleMember(p.user_id)} className={cn("w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left transition-colors", selectedMembers.includes(p.user_id) ? "bg-primary/10 text-primary" : "hover:bg-accent")}>
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(p.full_name)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1">{p.full_name}</span>
                    {selectedMembers.includes(p.user_id) && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
          <Button onClick={create} disabled={!name.trim()} className="w-full">Skapa</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewDmDialog({ open, onOpenChange, userId, profiles, memberships, channels, onSelect, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; userId?: string; profiles: Profile[];
  memberships: string[]; channels: Channel[];
  onSelect: (id: string) => void; onCreated: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const filtered = profiles.filter(p => {
    if (p.user_id === userId) return false;
    if (search && !p.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const startDm = async (targetUserId: string) => {
    if (!userId) return;
    const { data: channelId, error } = await supabase.rpc("create_dm_channel", { _target_user_id: targetUserId });
    if (error || !channelId) {
      toast({ title: "Fel", description: error?.message || "Kunde inte skapa DM", variant: "destructive" });
      return;
    }
    onCreated(channelId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Nytt DM"><Users className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nytt direktmeddelande</DialogTitle></DialogHeader>
        <Input placeholder="Sök kollega..." value={search} onChange={e => setSearch(e.target.value)} />
        <ScrollArea className="max-h-64">
          <div className="space-y-1">
            {filtered.map(p => (
              <button key={p.user_id} onClick={() => startDm(p.user_id)} className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-sm text-left">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(p.full_name)}</AvatarFallback>
                </Avatar>
                <span>{p.full_name}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ChannelMembersManager({ channelId, isCreator, profiles, currentMembers, onChanged, channelCreatedBy }: {
  channelId: string; isCreator: boolean; profiles: Profile[]; currentMembers: string[]; onChanged: () => void; channelCreatedBy: string;
}) {
  const [open, setOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [transferring, setTransferring] = useState(false);
  const { toast } = useToast();

  const transferOwnership = async (newOwnerId: string) => {
    setTransferring(true);
    const { error } = await supabase.from("chat_channels").update({ created_by: newOwnerId }).eq("id", channelId);
    setTransferring(false);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    onChanged();
    toast({ title: "Ägare bytt" });
  };

  const filteredProfiles = profiles.filter(p => {
    if (memberSearch && !p.full_name.toLowerCase().includes(memberSearch.toLowerCase())) return false;
    return true;
  });

  const addMember = async (uid: string) => {
    const { error } = await supabase.from("chat_channel_members").insert({ channel_id: channelId, user_id: uid });
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    onChanged();
    toast({ title: "Medlem tillagd" });
  };

  const removeMember = async (uid: string) => {
    const { error } = await supabase.from("chat_channel_members").delete().eq("channel_id", channelId).eq("user_id", uid);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    onChanged();
    toast({ title: "Medlem borttagen" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 h-8">
          <Users className="h-4 w-4" />
          <span className="text-xs">{currentMembers.length}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Gruppmedlemmar</DialogTitle></DialogHeader>
        {isCreator && (
          <>
            <Input placeholder="Sök för att lägga till..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
            <ScrollArea className="max-h-40">
              <div className="space-y-0.5">
                {filteredProfiles.filter(p => !currentMembers.includes(p.user_id)).slice(0, 20).map(p => (
                  <button key={p.user_id} onClick={() => addMember(p.user_id)} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent text-sm text-left">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(p.full_name)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1">{p.full_name}</span>
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </ScrollArea>
            <Separator />
          </>
        )}
        <div>
          <label className="text-sm font-medium mb-1 block">Nuvarande medlemmar ({currentMembers.length})</label>
          <ScrollArea className="max-h-48">
            <div className="space-y-0.5">
              {currentMembers.map(uid => {
                const p = profiles.find(pr => pr.user_id === uid);
                const isOwner = uid === channelCreatedBy;
                return (
                  <div key={uid} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(p?.full_name || "?")}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1">{p?.full_name || "Okänd"}{isOwner && <span className="ml-1 text-xs text-muted-foreground">(ägare)</span>}</span>
                    {isCreator && !isOwner && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => transferOwnership(uid)} disabled={transferring} title="Gör till ägare" className="text-muted-foreground hover:text-primary">
                          <Crown className="h-4 w-4" />
                        </button>
                        <button onClick={() => removeMember(uid)} className="text-muted-foreground hover:text-destructive">
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChannelActionMenu({ channel, userId, onLeft }: { channel: Channel; userId?: string; onLeft: () => void }) {
  const { toast } = useToast();
  const isOwner = channel.created_by === userId;
  const isGroup = channel.type === "group";

  const handleLeave = async () => {
    if (!userId) return;
    if (isGroup && isOwner) {
      toast({ title: "Du är ägare", description: "Överför ägarskapet till en annan medlem innan du lämnar gruppen.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("chat_channel_members").delete().eq("channel_id", channel.id).eq("user_id", userId);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    // Also remove read status
    await supabase.from("chat_read_status").delete().eq("channel_id", channel.id).eq("user_id", userId);
    toast({ title: isGroup ? "Du lämnade gruppen" : "Konversation stängd" });
    onLeft();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleLeave} className="text-destructive focus:text-destructive">
          {isGroup ? <LogOut className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
          {isGroup ? "Lämna grupp" : "Stäng konversation"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
