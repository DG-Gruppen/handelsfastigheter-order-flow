import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Hash, MessageCircle, Plus, Send, Users, Search, SmilePlus, Reply, MoreHorizontal, Pencil, Trash2, X, ArrowLeft, UserPlus, Settings, UserMinus, Check } from "lucide-react";
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
import { format, isToday, isYesterday } from "date-fns";
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

// ─── Helper ───
function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Igår " + format(d, "HH:mm");
  return format(d, "d MMM HH:mm", { locale: sv });
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🤔", "👀"];

// ─── Main ───
export default function Chat({ embedded }: { embedded?: boolean } = {}) {
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
      // Only fetch channels the user is a member of (RLS enforces this)
      const { data } = await supabase.from("chat_channels").select("*").eq("is_archived", false).order("name");
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
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").eq("is_hidden", false);
      return (data ?? []) as Profile[];
    },
    enabled: !!user,
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach(p => m.set(p.user_id, p));
    return m;
  }, [profiles]);

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

  // Thread reply counts
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

  // ─── Realtime ───
  useEffect(() => {
    if (!activeChannelId) return;
    const channel = supabase
      .channel(`chat-${activeChannelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `channel_id=eq.${activeChannelId}` }, () => {
        qc.invalidateQueries({ queryKey: ["chat-messages", activeChannelId] });
        qc.invalidateQueries({ queryKey: ["chat-reply-counts", activeChannelId] });
        if (threadParent) qc.invalidateQueries({ queryKey: ["chat-thread", threadParent.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reactions" }, () => {
        qc.invalidateQueries({ queryKey: ["chat-reactions", activeChannelId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeChannelId, threadParent?.id, qc]);

  // ─── Mutations ───
  const joinChannel = useMutation({
    mutationFn: async (channelId: string) => {
      await supabase.from("chat_channel_members").insert({ channel_id: channelId, user_id: user!.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-memberships"] }),
  });

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
      if (threadParent) qc.invalidateQueries({ queryKey: ["chat-thread", threadParent.id] });
    },
  });

  const deleteMsg = useMutation({
    mutationFn: async (msgId: string) => {
      await supabase.from("chat_messages").delete().eq("id", msgId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages", activeChannelId] });
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
  }, [user, qc]);

  // Mark as read when switching channels
  useEffect(() => {
    if (activeChannelId) updateReadStatus(activeChannelId);
  }, [activeChannelId, messages.length]);

  // ─── Filtered channels ───
  const filteredChannels = useMemo(() => {
    const s = search.toLowerCase();
    return channels.filter(c => {
      // RLS already filters to only member channels, but double-check memberships for UI
      if (s && !c.name.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [channels, search]);

  const groupChannels = filteredChannels.filter(c => c.type === "group");
  const dmChannels = filteredChannels.filter(c => c.type === "dm");

  const handleSelectChannel = (id: string) => {
    setActiveChannelId(id);
    setThreadParent(null);
    setMobileShowChat(true);
  };

  return (
    <div className={cn("flex rounded-xl border border-border bg-card overflow-hidden", embedded ? "h-full" : "h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)]")}>
      {/* ─── Sidebar ─── */}
      <div className={cn(
        "w-full md:w-72 shrink-0 border-r border-border flex flex-col bg-muted/30",
        mobileShowChat && "hidden md:flex"
      )}>
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Chatt</h2>
            <div className="flex gap-1">
              <NewChannelDialog open={showNewChannel} onOpenChange={setShowNewChannel} userId={user?.id} profiles={profiles} onCreated={() => { qc.invalidateQueries({ queryKey: ["chat-channels"] }); qc.invalidateQueries({ queryKey: ["chat-memberships"] }); setShowNewChannel(false); }} />
              <NewDmDialog open={showNewDm} onOpenChange={setShowNewDm} userId={user?.id} profiles={profiles} memberships={memberships} channels={channels} onSelect={(id) => { handleSelectChannel(id); setShowNewDm(false); }} onCreated={(id) => { qc.invalidateQueries({ queryKey: ["chat-channels"] }); qc.invalidateQueries({ queryKey: ["chat-memberships"] }); handleSelectChannel(id); setShowNewDm(false); }} />
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sök kanal..." className="pl-8 h-8 text-sm" />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-2 pb-2 space-y-1">
            {groupChannels.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Kanaler</div>
                {groupChannels.map(c => (
                  <ChannelItem key={c.id} channel={c} isActive={c.id === activeChannelId} isMember={memberships.includes(c.id)} onClick={() => handleSelectChannel(c.id)} />
                ))}
              </>
            )}
            {dmChannels.length > 0 && (
              <>
                <div className="px-2 py-1 mt-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Direktmeddelanden</div>
                {dmChannels.map(c => {
                  // For DM, show other person's name
                  const otherName = c.name;
                  return (
                    <ChannelItem key={c.id} channel={{ ...c, name: otherName }} isActive={c.id === activeChannelId} isMember={true} onClick={() => handleSelectChannel(c.id)} isDm />
                  );
                })}
              </>
            )}
            {filteredChannels.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Inga kanaler hittades</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ─── Main chat area ─── */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0",
        !mobileShowChat && "hidden md:flex"
      )}>
        {activeChannel ? (
          <>
            {/* Header */}
            <div className="h-14 px-4 flex items-center gap-3 border-b border-border shrink-0">
              <button className="md:hidden" onClick={() => setMobileShowChat(false)}>
                <ArrowLeft className="h-5 w-5" />
              </button>
              {activeChannel.type === "group" ? <Hash className="h-5 w-5 text-muted-foreground" /> : <MessageCircle className="h-5 w-5 text-muted-foreground" />}
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{activeChannel.name}</h3>
                {activeChannel.description && <p className="text-xs text-muted-foreground truncate">{activeChannel.description}</p>}
              </div>
            </div>

            {/* Messages */}
            <MessageList
              messages={messages}
              reactions={reactions}
              profileMap={profileMap}
              userId={user?.id}
              replyCounts={replyCounts as Record<string, number>}
              onReply={setThreadParent}
              onReact={(msgId, emoji) => toggleReaction.mutate({ messageId: msgId, emoji })}
              onDelete={(msgId) => deleteMsg.mutate(msgId)}
            />

            {/* Compose */}
            <ComposeBar onSend={(content) => sendMsg.mutate({ content })} disabled={!memberships.includes(activeChannelId!)} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <MessageCircle className="h-12 w-12 mx-auto opacity-30" />
              <p className="text-sm">Välj en kanal för att börja chatta</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Thread panel ─── */}
      {threadParent && (
        <div className="hidden md:flex w-80 border-l border-border flex-col bg-muted/20">
          <div className="h-14 px-4 flex items-center justify-between border-b border-border shrink-0">
            <h4 className="font-semibold text-sm">Tråd</h4>
            <button onClick={() => setThreadParent(null)}><X className="h-4 w-4" /></button>
          </div>
          {/* Parent message */}
          <div className="p-3 border-b border-border">
            <MessageBubble msg={threadParent} profile={profileMap.get(threadParent.user_id)} userId={user?.id} reactions={reactions.filter(r => r.message_id === threadParent.id)} compact onReact={(emoji) => toggleReaction.mutate({ messageId: threadParent.id, emoji })} />
          </div>
          <ScrollArea className="flex-1 p-3 space-y-2">
            {threadMessages.map(m => (
              <MessageBubble key={m.id} msg={m} profile={profileMap.get(m.user_id)} userId={user?.id} reactions={[]} compact onDelete={() => deleteMsg.mutate(m.id)} />
            ))}
          </ScrollArea>
          <ComposeBar onSend={(content) => sendMsg.mutate({ content, parentId: threadParent.id })} placeholder="Svara i tråd..." />
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───

function ChannelItem({ channel, isActive, isMember, onClick, isDm }: { channel: Channel; isActive: boolean; isMember: boolean; onClick: () => void; isDm?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
        isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent/50 text-foreground",
        !isMember && "opacity-60"
      )}
    >
      {isDm ? <MessageCircle className="h-4 w-4 shrink-0" /> : <Hash className="h-4 w-4 shrink-0" />}
      <span className="truncate">{channel.name}</span>
    </button>
  );
}

function MessageList({
  messages, reactions, profileMap, userId, replyCounts, onReply, onReact, onDelete
}: {
  messages: Message[];
  reactions: Reaction[];
  profileMap: Map<string, Profile>;
  userId?: string;
  replyCounts: Record<string, number>;
  onReply: (msg: Message) => void;
  onReact: (msgId: string, emoji: string) => void;
  onDelete: (msgId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const sameUser = prev && prev.user_id === msg.user_id;
        const timeDiff = prev ? new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() : Infinity;
        const grouped = sameUser && timeDiff < 5 * 60 * 1000;
        const msgReactions = reactions.filter(r => r.message_id === msg.id);
        const replyCount = replyCounts[msg.id] || 0;

        return (
          <div key={msg.id} className={cn("group", !grouped && i > 0 && "mt-4")}>
            <MessageBubble
              msg={msg}
              profile={profileMap.get(msg.user_id)}
              userId={userId}
              reactions={msgReactions}
              grouped={grouped}
              replyCount={replyCount}
              onReply={() => onReply(msg)}
              onReact={(emoji) => onReact(msg.id, emoji)}
              onDelete={() => onDelete(msg.id)}
            />
          </div>
        );
      })}
      {messages.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-8">Inga meddelanden ännu. Skriv det första!</p>
      )}
    </div>
  );
}

function MessageBubble({
  msg, profile, userId, reactions = [], grouped, compact, replyCount, onReply, onReact, onDelete
}: {
  msg: Message;
  profile?: Profile;
  userId?: string;
  reactions?: Reaction[];
  grouped?: boolean;
  compact?: boolean;
  replyCount?: number;
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  onDelete?: () => void;
}) {
  const name = profile?.full_name || "Okänd";
  const isOwn = msg.user_id === userId;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Group reactions by emoji
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

  return (
    <div className={cn("flex gap-3", compact && "gap-2")}>
      {!grouped ? (
        <Avatar className={cn("h-8 w-8 shrink-0 mt-0.5", compact && "h-6 w-6")}>
          <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(name)}</AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        {!grouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-[11px] text-muted-foreground">{formatMsgTime(msg.created_at)}</span>
            {msg.is_edited && <span className="text-[10px] text-muted-foreground">(redigerad)</span>}
          </div>
        )}
        <div className="relative group/msg">
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-0.5">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>

          {/* Action buttons on hover */}
          <div className="absolute -top-3 right-0 hidden group-hover/msg:flex bg-card border border-border rounded-md shadow-sm">
            {QUICK_EMOJIS.slice(0, 3).map(e => (
              <button key={e} onClick={() => onReact?.(e)} className="px-1.5 py-1 hover:bg-accent text-sm">{e}</button>
            ))}
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <button className="px-1.5 py-1 hover:bg-accent"><SmilePlus className="h-3.5 w-3.5" /></button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-0" side="top">
                <Picker data={data} onEmojiSelect={(e: any) => { onReact?.(e.native); setShowEmojiPicker(false); }} theme="auto" previewPosition="none" skinTonePosition="none" />
              </PopoverContent>
            </Popover>
            {onReply && (
              <button onClick={onReply} className="px-1.5 py-1 hover:bg-accent"><Reply className="h-3.5 w-3.5" /></button>
            )}
            {isOwn && onDelete && (
              <button onClick={onDelete} className="px-1.5 py-1 hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            )}
          </div>
        </div>

        {/* Reactions */}
        {groupedReactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {groupedReactions.map(r => (
              <button
                key={r.emoji}
                onClick={() => onReact?.(r.emoji)}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors",
                  r.hasOwn ? "bg-primary/10 border-primary/30" : "bg-muted border-border hover:bg-accent"
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
          <button onClick={onReply} className="flex items-center gap-1 mt-1 text-xs text-primary hover:underline">
            <Reply className="h-3 w-3" />
            {replyCount} {replyCount === 1 ? "svar" : "svar"}
          </button>
        )}
      </div>
    </div>
  );
}

function ComposeBar({ onSend, disabled, placeholder }: { onSend: (content: string) => void; disabled?: boolean; placeholder?: string }) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
    inputRef.current?.focus();
  };

  return (
    <div className="border-t border-border p-3 flex gap-2">
      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        placeholder={disabled ? "Gå med i kanalen för att skriva..." : (placeholder || "Skriv ett meddelande...")}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground disabled:opacity-50"
      />
      <Button size="icon" onClick={handleSend} disabled={!text.trim() || disabled} className="rounded-xl shrink-0">
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Dialogs ───

function NewChannelDialog({ open, onOpenChange, userId, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; userId?: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const { toast } = useToast();

  const create = async () => {
    if (!name.trim() || !userId) return;
    const { error } = await supabase.from("chat_channels").insert({ name: name.trim(), description: desc.trim(), type: "group", created_by: userId });
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    // Auto-join
    const { data: ch } = await supabase.from("chat_channels").select("id").eq("name", name.trim()).eq("created_by", userId).order("created_at", { ascending: false }).limit(1).single();
    if (ch) await supabase.from("chat_channel_members").insert({ channel_id: ch.id, user_id: userId });
    setName(""); setDesc("");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Ny kanal"><Plus className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Skapa kanal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Kanalnamn" value={name} onChange={e => setName(e.target.value)} />
          <Input placeholder="Beskrivning (valfritt)" value={desc} onChange={e => setDesc(e.target.value)} />
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
    // Use RPC to create/find DM atomically (handles member insertion securely)
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
