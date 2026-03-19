import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  KeyRound, Plus, Pencil, Trash2, Eye, EyeOff, Copy, ExternalLink, Search,
  ClipboardList, RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";

// --- Types ---

interface SharedPassword {
  id: string;
  service_name: string;
  username: string;
  password_value: string;
  url: string;
  notes: string;
  created_by: string;
  created_at: string;
}


interface AccessLogEntry {
  id: string;
  password_id: string;
  user_id: string;
  action: string;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string;
}

const EMPTY_FORM = {
  service_name: "",
  username: "",
  password_value: "",
  url: "",
  notes: "",
};

function generatePassword(length = 20): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*?";
  const all = upper + lower + digits + symbols;
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  const required = [
    upper[arr[0] % upper.length],
    lower[arr[1] % lower.length],
    digits[arr[2] % digits.length],
    symbols[arr[3] % symbols.length],
  ];
  const rest = Array.from({ length: length - 4 }, (_, i) => all[arr[i + 4] % all.length]);
  const result = [...required, ...rest];
  for (let i = result.length - 1; i > 0; i--) {
    const j = arr[i] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result.join("");
}

const ACTION_LABELS: Record<string, string> = {
  viewed: "visade lösenord",
  copied_password: "kopierade lösenord",
  copied_username: "kopierade användarnamn",
};

export default function Passwords() {
  const { user, roles } = useAuth();
  const isEditor = roles.includes("admin") || roles.includes("it");

  const [passwords, setPasswords] = useState<SharedPassword[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Visibility state
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

  // Access log state (admin/IT only)
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logPasswordId, setLogPasswordId] = useState<string | null>(null);
  const [logEntries, setLogEntries] = useState<AccessLogEntry[]>([]);
  const [logProfiles, setLogProfiles] = useState<Profile[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const fetchData = async () => {
    const { data } = await supabase.from("shared_passwords").select("*").order("service_name");
    setPasswords((data as SharedPassword[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return passwords;
    const q = search.toLowerCase();
    return passwords.filter(p =>
      p.service_name.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      p.notes.toLowerCase().includes(q)
    );
  }, [passwords, search]);


  // --- Access logging ---
  const logAccess = async (passwordId: string, action: string) => {
    if (!user) return;
    await supabase.from("password_access_log" as any).insert({
      password_id: passwordId,
      user_id: user.id,
      action,
    } as any);
  };

  // Open dialog
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (pw: SharedPassword) => {
    setEditingId(pw.id);
    setForm({
      service_name: pw.service_name,
      username: pw.username,
      password_value: pw.password_value,
      url: pw.url,
      notes: pw.notes,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.service_name.trim()) { toast.error("Tjänstnamn krävs"); return; }
    setSaving(true);

    try {
      let pwId = editingId;

      if (editingId) {
        const { error } = await supabase.from("shared_passwords").update({
          service_name: form.service_name.trim(),
          username: form.username.trim(),
          password_value: form.password_value,
          url: form.url.trim(),
          notes: form.notes.trim(),
        } as any).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("shared_passwords").insert({
          service_name: form.service_name.trim(),
          username: form.username.trim(),
          password_value: form.password_value,
          url: form.url.trim(),
          notes: form.notes.trim(),
          created_by: user!.id,
        } as any).select("id").single();
        if (error) throw error;
        pwId = (data as any).id;
      }

      toast.success(editingId ? "Lösenord uppdaterat" : "Lösenord skapat");
      setDialogOpen(false);
      fetchData();
    } catch {
      toast.error("Kunde inte spara");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("shared_passwords").delete().eq("id", deleteId);
    toast.success("Lösenord borttaget");
    setDeleteId(null);
    fetchData();
  };

  const toggleVisible = (id: string) => {
    setVisibleIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        logAccess(id, "viewed");
      }
      return next;
    });
  };

  const copyToClipboard = (passwordId: string, text: string, label: string, action: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopierat`);
    logAccess(passwordId, action);
  };

  // --- Access log viewer ---
  const openAccessLog = async (passwordId: string) => {
    setLogPasswordId(passwordId);
    setLogDialogOpen(true);
    setLogLoading(true);

    const [logRes, profilesRes] = await Promise.all([
      supabase
        .from("password_access_log" as any)
        .select("*")
        .eq("password_id", passwordId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("profiles").select("user_id, full_name"),
    ]);

    setLogEntries(((logRes.data as unknown) as AccessLogEntry[]) ?? []);
    setLogProfiles((profilesRes.data as Profile[]) ?? []);
    setLogLoading(false);
  };

  const logProfileMap = useMemo(() => new Map(logProfiles.map(p => [p.user_id, p.full_name])), [logProfiles]);
  const logPasswordName = passwords.find(p => p.id === logPasswordId)?.service_name ?? "";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <KeyRound className="h-7 w-7 text-primary" />
            Lösenord
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gemensamma lösenord för bolagets tjänster</p>
        </div>
        {isEditor && (
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Lägg till
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Sök tjänst..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <KeyRound className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">{passwords.length === 0 ? "Inga lösenord tillagda ännu" : "Inga träffar"}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(pw => {
            const isVisible = visibleIds.has(pw.id);
            return (
              <div key={pw.id} className="bg-card rounded-xl border border-border p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{pw.service_name}</h3>
                      {pw.url && (
                        <a href={pw.url} target="_blank" rel="noopener noreferrer"
                           className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                          <ExternalLink className="h-3 w-3" /> Öppna
                        </a>
                      )}
                    </div>
                  </div>
                  {isEditor && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Åtkomstlogg"
                              onClick={() => openAccessLog(pw.id)}>
                        <ClipboardList className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(pw)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(pw.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {pw.username && (
                    <div>
                      <span className="text-muted-foreground text-xs">Användarnamn</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{pw.username}</code>
                        <button onClick={() => copyToClipboard(pw.id, pw.username, "Användarnamn", "copied_username")}
                                className="text-muted-foreground hover:text-foreground">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  {pw.password_value && (
                    <div>
                      <span className="text-muted-foreground text-xs">Lösenord</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                          {isVisible ? pw.password_value : "••••••••••"}
                        </code>
                        <button onClick={() => toggleVisible(pw.id)}
                                className="text-muted-foreground hover:text-foreground">
                          {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => copyToClipboard(pw.id, pw.password_value, "Lösenord", "copied_password")}
                                className="text-muted-foreground hover:text-foreground">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {pw.notes && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap border-t border-border/50 pt-2 mt-1">{pw.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Redigera lösenord" : "Nytt lösenord"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tjänstnamn *</Label>
              <Input value={form.service_name} onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))} placeholder="t.ex. Microsoft 365" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Användarnamn</Label>
                <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="admin@foretag.se" />
              </div>
              <div>
                <Label>Lösenord</Label>
                <div className="flex gap-1.5">
                  <Input value={form.password_value} onChange={e => setForm(f => ({ ...f, password_value: e.target.value }))} placeholder="••••••••" className="flex-1" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    title="Generera lösenord"
                    onClick={() => setForm(f => ({ ...f, password_value: generatePassword() }))}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <Label>URL</Label>
              <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://login.example.com" />
            </div>
            <div>
              <Label>Anteckningar</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Extra info..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Avbryt</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Sparar..." : "Spara"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort lösenord?</AlertDialogTitle>
            <AlertDialogDescription>
              Lösenordet tas bort permanent och kan inte återställas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Access log dialog (admin/IT only) */}
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Åtkomstlogg – {logPasswordName}
            </DialogTitle>
          </DialogHeader>

          {logLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : logEntries.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Ingen aktivitet registrerad</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px] pr-2">
              <div className="space-y-2">
                {logEntries.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 rounded-lg bg-muted/40 p-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <p>
                        <span className="font-medium">{logProfileMap.get(entry.user_id) ?? "Okänd"}</span>
                        {" "}
                        <span className="text-muted-foreground">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: sv })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
