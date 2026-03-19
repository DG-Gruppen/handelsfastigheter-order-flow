import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

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

interface PasswordGroup {
  password_id: string;
  group_id: string;
}

interface Group {
  id: string;
  name: string;
  color: string | null;
}

const EMPTY_FORM = {
  service_name: "",
  username: "",
  password_value: "",
  url: "",
  notes: "",
};

export default function Passwords() {
  const { user, roles } = useAuth();
  const isEditor = roles.includes("admin") || roles.includes("it");

  const [passwords, setPasswords] = useState<SharedPassword[]>([]);
  const [passwordGroups, setPasswordGroups] = useState<PasswordGroup[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Visibility state
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    const [pwRes, pgRes, grRes] = await Promise.all([
      supabase.from("shared_passwords").select("*").order("service_name"),
      supabase.from("shared_password_groups").select("password_id, group_id"),
      supabase.from("groups").select("id, name, color").order("name"),
    ]);
    setPasswords((pwRes.data as SharedPassword[]) ?? []);
    setPasswordGroups((pgRes.data as PasswordGroup[]) ?? []);
    setGroups((grRes.data as Group[]) ?? []);
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

  const groupMap = useMemo(() => new Map(groups.map(g => [g.id, g])), [groups]);

  const getGroupsForPassword = (pwId: string) =>
    passwordGroups.filter(pg => pg.password_id === pwId).map(pg => groupMap.get(pg.group_id)).filter(Boolean) as Group[];

  // Open dialog
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSelectedGroupIds([]);
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
    setSelectedGroupIds(passwordGroups.filter(pg => pg.password_id === pw.id).map(pg => pg.group_id));
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

      // Sync groups
      if (pwId) {
        await supabase.from("shared_password_groups").delete().eq("password_id", pwId);
        if (selectedGroupIds.length > 0) {
          await supabase.from("shared_password_groups").insert(
            selectedGroupIds.map(gid => ({ password_id: pwId, group_id: gid })) as any
          );
        }
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
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopierat`);
  };

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
            const pwGroups = getGroupsForPassword(pw.id);
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
                    {pwGroups.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {pwGroups.map(g => (
                          <Badge key={g.id} variant="secondary" className="text-[10px] px-1.5 py-0"
                                 style={g.color ? { backgroundColor: g.color + "22", color: g.color, borderColor: g.color + "44" } : {}}>
                            {g.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {isEditor && (
                    <div className="flex items-center gap-1 shrink-0">
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
                        <button onClick={() => copyToClipboard(pw.username, "Användarnamn")}
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
                        <button onClick={() => copyToClipboard(pw.password_value, "Lösenord")}
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
                <Input value={form.password_value} onChange={e => setForm(f => ({ ...f, password_value: e.target.value }))} placeholder="••••••••" />
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
            <div>
              <Label className="mb-2 block">Synlig för grupper</Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {groups.map(g => (
                  <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedGroupIds.includes(g.id)}
                      onCheckedChange={(checked) => {
                        setSelectedGroupIds(prev =>
                          checked ? [...prev, g.id] : prev.filter(id => id !== g.id)
                        );
                      }}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Om inga grupper väljs ser bara admin/IT lösenordet
              </p>
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
    </div>
  );
}
