import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, Plus, Trash2, UserPlus, X, Shield, Pencil, Lock } from "lucide-react";

interface Group {
  id: string;
  name: string;
  description: string;
  color: string | null;
  is_system: boolean;
  role_equivalent: string | null;
  created_at: string;
}

interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
}

export default function GroupsManager() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [addUserId, setAddUserId] = useState("");

  const fetchData = useCallback(async () => {
    const [g, m, p] = await Promise.all([
      supabase.from("groups").select("*").order("is_system", { ascending: false }).order("name"),
      supabase.from("group_members").select("*"),
      supabase.from("profiles").select("user_id, full_name, email, department"),
    ]);
    // Hide system groups (e.g. Superadmin) from the UI
    const allGroups = (g.data as Group[]) ?? [];
    setGroups(allGroups.filter(grp => !grp.is_system));
    setMembers((m.data as GroupMember[]) ?? []);
    setProfiles(((p.data as Profile[]) ?? []).filter(pr => pr.full_name && !(pr as any).is_hidden));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const groupMembers = (groupId: string) => members.filter(m => m.group_id === groupId);
  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId);
  const nonMembers = (groupId: string) => {
    const memberIds = new Set(groupMembers(groupId).map(m => m.user_id));
    return profiles.filter(p => !memberIds.has(p.user_id));
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from("groups").insert({
      name: newName.trim(),
      description: newDesc.trim(),
      color: newColor,
      created_by: user?.id,
    } as any);
    if (error) { toast.error(error.code === "23505" ? "Gruppnamnet finns redan" : "Kunde inte skapa grupp"); return; }
    toast.success("Grupp skapad");
    setShowCreate(false); setNewName(""); setNewDesc(""); setNewColor("#3b82f6");
    fetchData();
  };

  const handleDelete = async (group: Group) => {
    if (group.is_system) { toast.error("Systemgrupper kan inte tas bort"); return; }
    if (!confirm(`Vill du ta bort gruppen "${group.name}"?`)) return;
    await supabase.from("groups").delete().eq("id", group.id);
    toast.success("Grupp borttagen");
    if (selectedGroup?.id === group.id) setSelectedGroup(null);
    fetchData();
  };

  const handleUpdate = async () => {
    if (!editGroup) return;
    await supabase.from("groups").update({
      name: editGroup.name,
      description: editGroup.description,
      color: editGroup.color,
    } as any).eq("id", editGroup.id);
    toast.success("Grupp uppdaterad");
    setEditGroup(null);
    fetchData();
  };

  const handleAddMember = async (groupId: string, userId: string) => {
    const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: userId } as any);
    if (error) { toast.error("Kunde inte lägga till medlem"); return; }
    toast.success("Medlem tillagd");
    setAddUserId("");
    fetchData();
  };

  const handleRemoveMember = async (memberId: string) => {
    await supabase.from("group_members").delete().eq("id", memberId);
    toast.success("Medlem borttagen");
    fetchData();
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card border-t-2 border-t-primary/40">
        <CardHeader className="px-4 md:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-primary/10 shadow-sm shadow-primary/10">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="font-heading text-base md:text-lg text-primary">Grupper</CardTitle>
                <CardDescription className="text-xs">Skapa grupper och hantera medlemskap</CardDescription>
              </div>
            </div>
            <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Ny grupp
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {groups.map(group => {
              const mCount = groupMembers(group.id).length;
              const isSelected = selectedGroup?.id === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(isSelected ? null : group)}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border/50 bg-secondary/30 hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: group.color || "#94a3b8" }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm truncate">{group.name}</p>
                          {group.is_system && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{group.description || "Ingen beskrivning"}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">{mCount}</Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected group detail */}
      {selectedGroup && (
        <Card className="glass-card border-t-2" style={{ borderTopColor: selectedGroup.color || undefined }}>
          <CardHeader className="px-4 md:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: selectedGroup.color || "#94a3b8" }} />
                <div>
                  <CardTitle className="font-heading text-base">{selectedGroup.name}</CardTitle>
                  <CardDescription className="text-xs">{selectedGroup.description || "Ingen beskrivning"}</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                {!selectedGroup.is_system && (
                  <>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditGroup({ ...selectedGroup })}>
                      <Pencil className="h-3.5 w-3.5" /> Redigera
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(selectedGroup)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-3">
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger className="flex-1 h-10">
                  <SelectValue placeholder="Lägg till medlem..." />
                </SelectTrigger>
                <SelectContent>
                  {nonMembers(selectedGroup.id).map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name} — {p.department || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-10 gap-1" disabled={!addUserId} onClick={() => handleAddMember(selectedGroup.id, addUserId)}>
                <UserPlus className="h-4 w-4" /> Lägg till
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="space-y-1.5">
              {groupMembers(selectedGroup.id).length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Inga medlemmar i gruppen</p>
              )}
              {groupMembers(selectedGroup.id).map(member => {
                const profile = getProfile(member.user_id);
                if (!profile) return null;
                return (
                  <div key={member.id} className="flex items-center justify-between rounded-xl bg-secondary/20 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{profile.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{profile.department || profile.email}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={() => handleRemoveMember(member.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skapa ny grupp</DialogTitle>
            <DialogDescription>Grupper används för att styra åtkomst till moduler och funktioner</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Namn</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="T.ex. Dokumentansvariga" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Beskrivning</label>
              <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Kort beskrivning av gruppen" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Färg</label>
              <div className="flex items-center gap-3">
                <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="h-10 w-10 rounded cursor-pointer" />
                <span className="text-sm text-muted-foreground">{newColor}</span>
              </div>
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={!newName.trim()}>Skapa grupp</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editGroup} onOpenChange={() => setEditGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigera grupp</DialogTitle>
            <DialogDescription>Uppdatera gruppens namn, beskrivning och färg</DialogDescription>
          </DialogHeader>
          {editGroup && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Namn</label>
                <Input value={editGroup.name} onChange={e => setEditGroup({ ...editGroup, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Beskrivning</label>
                <Input value={editGroup.description} onChange={e => setEditGroup({ ...editGroup, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Färg</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={editGroup.color || "#94a3b8"} onChange={e => setEditGroup({ ...editGroup, color: e.target.value })} className="h-10 w-10 rounded cursor-pointer" />
                </div>
              </div>
              <Button className="w-full" onClick={handleUpdate}>Spara ändringar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
