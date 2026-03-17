import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, Eye, Pencil, Trash2, Crown, Plus, Users, User, Clock, X } from "lucide-react";
import { getModuleIcon } from "@/lib/moduleIcons";

interface Module {
  id: string;
  name: string;
  slug: string;
  route: string;
  icon: string;
  is_active: boolean;
}

interface ModulePermission {
  id: string;
  module_id: string;
  grantee_type: string;
  grantee_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  is_owner: boolean;
}

interface Group {
  id: string;
  name: string;
  color: string | null;
  is_system: boolean;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

interface ActivityLog {
  id: string;
  module_id: string;
  user_id: string;
  action: string;
  entity_type: string | null;
  entity_name: string | null;
  created_at: string;
}

export default function ModulePermissionsManager() {
  const { user } = useAuth();
  const { refresh: refreshSidebar } = useModules();
  const [modules, setModules] = useState<Module[]>([]);
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [addType, setAddType] = useState<"group" | "user">("group");
  const [addId, setAddId] = useState("");

  const fetchData = useCallback(async () => {
    const [m, p, g, pr] = await Promise.all([
      supabase.from("modules").select("*").order("sort_order"),
      supabase.from("module_permissions").select("*"),
      supabase.from("groups").select("id, name, color, is_system").order("name"),
      supabase.from("profiles").select("user_id, full_name, email"),
    ]);
    setModules((m.data as Module[]) ?? []);
    setPermissions((p.data as ModulePermission[]) ?? []);
    setGroups((g.data as Group[]) ?? []);
    setProfiles(((pr.data as Profile[]) ?? []).filter(p => p.full_name && p.email !== "toni@kazarian.se"));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchActivity = useCallback(async (moduleId: string) => {
    const { data } = await supabase
      .from("module_activity_log")
      .select("*")
      .eq("module_id", moduleId)
      .order("created_at", { ascending: false })
      .limit(50);
    setActivityLog((data as ActivityLog[]) ?? []);
  }, []);

  useEffect(() => {
    if (selectedModule) fetchActivity(selectedModule.id);
  }, [selectedModule, fetchActivity]);

  const modulePerms = (moduleId: string) => permissions.filter(p => p.module_id === moduleId);

  const getGranteeName = (perm: ModulePermission) => {
    if (perm.grantee_type === "group") {
      return groups.find(g => g.id === perm.grantee_id)?.name || "Okänd grupp";
    }
    return profiles.find(p => p.user_id === perm.grantee_id)?.full_name || "Okänd användare";
  };

  const getGranteeColor = (perm: ModulePermission) => {
    if (perm.grantee_type === "group") {
      return groups.find(g => g.id === perm.grantee_id)?.color || "#94a3b8";
    }
    return "#6366f1";
  };

  const handleAddPermission = async (moduleId: string) => {
    if (!addId) return;
    const { error } = await supabase.from("module_permissions").insert({
      module_id: moduleId,
      grantee_type: addType,
      grantee_id: addId,
      can_view: true,
      can_edit: false,
      can_delete: false,
      is_owner: false,
      created_by: user?.id,
    } as any);
    if (error) {
      toast.error(error.code === "23505" ? "Rättighet finns redan" : "Kunde inte lägga till");
      return;
    }
    toast.success("Rättighet tillagd");
    setAddId("");
    fetchData();
  };

  const handleToggle = async (permId: string, field: string, value: boolean) => {
    const update: any = { [field]: value };
    // If setting owner, also enable all other permissions
    if (field === "is_owner" && value) {
      update.can_view = true;
      update.can_edit = true;
      update.can_delete = true;
    }
    await supabase.from("module_permissions").update(update).eq("id", permId);
    fetchData();
  };

  const handleRemovePermission = async (permId: string) => {
    await supabase.from("module_permissions").delete().eq("id", permId);
    toast.success("Rättighet borttagen");
    fetchData();
  };

  const existingGranteeIds = selectedModule
    ? new Set(modulePerms(selectedModule.id).filter(p => p.grantee_type === addType).map(p => p.grantee_id))
    : new Set<string>();

  const availableOptions = addType === "group"
    ? groups.filter(g => !existingGranteeIds.has(g.id))
    : profiles.filter(p => !existingGranteeIds.has(p.user_id));

  return (
    <div className="space-y-4">
      <Card className="glass-card border-t-2 border-t-accent/40">
        <CardHeader className="px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-accent/10 shadow-sm shadow-accent/10">
              <Shield className="h-4 w-4 md:h-5 md:w-5 text-accent" />
            </div>
            <div>
              <CardTitle className="font-heading text-base md:text-lg text-accent">Modulrättigheter</CardTitle>
              <CardDescription className="text-xs">Styr vem som kan se, redigera och äga moduler</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
            {modules.map(mod => {
              const perms = modulePerms(mod.id);
              const owners = perms.filter(p => p.is_owner);
              const Icon = getModuleIcon(mod.icon);
              const isSelected = selectedModule?.id === mod.id;
              return (
                <div
                  key={mod.id}
                  className={`rounded-xl border p-3 transition-all ${
                    isSelected ? "border-accent bg-accent/5 shadow-md" : "border-border/50 bg-secondary/30 hover:bg-secondary/50"
                  } ${!mod.is_active ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <button
                      onClick={() => setSelectedModule(isSelected ? null : mod)}
                      className="flex items-center gap-2 text-left min-w-0 flex-1"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="font-medium text-sm truncate">{mod.name}</p>
                    </button>
                    <button
                      onClick={async () => {
                        await supabase.from("modules").update({ is_active: !mod.is_active } as any).eq("id", mod.id);
                        toast.success(!mod.is_active ? "Modul aktiverad" : "Modul inaktiverad");
                        fetchData();
                        refreshSidebar();
                      }}
                      className={`relative h-8 w-4 rounded-full p-[2px] transition-colors ${
                        mod.is_active ? "bg-emerald-500" : "bg-destructive"
                      }`}
                      title={mod.is_active ? "Aktiv – klicka för att inaktivera" : "Inaktiv – klicka för att aktivera"}
                    >
                      <div className={`absolute left-[2px] h-3 w-3 rounded-full bg-white shadow-sm transition-all duration-200 ${
                        mod.is_active ? "top-[2px]" : "bottom-[2px]"
                      }`} />
                    </button>
                  </div>
                  <button
                    onClick={() => setSelectedModule(isSelected ? null : mod)}
                    className="flex items-center gap-2 text-xs text-muted-foreground text-left w-full"
                  >
                    <span>{perms.length} rättighet{perms.length !== 1 ? "er" : ""}</span>
                    {owners.length > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 bg-warning/10 text-warning border-warning/20">
                        <Crown className="h-2.5 w-2.5" /> {owners.length}
                      </Badge>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected module detail */}
      {selectedModule && (
        <Card className="glass-card border-t-2 border-t-accent/40">
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="font-heading text-base">{selectedModule.name} — Rättigheter</CardTitle>
            <div className="flex items-center gap-2 pt-3 flex-wrap">
              <Select value={addType} onValueChange={v => { setAddType(v as "group" | "user"); setAddId(""); }}>
                <SelectTrigger className="w-[120px] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="group"><span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Grupp</span></SelectItem>
                  <SelectItem value="user"><span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Person</span></SelectItem>
                </SelectContent>
              </Select>
              <Select value={addId} onValueChange={setAddId}>
                <SelectTrigger className="flex-1 h-10 min-w-[200px]">
                  <SelectValue placeholder={addType === "group" ? "Välj grupp..." : "Välj person..."} />
                </SelectTrigger>
                <SelectContent>
                  {addType === "group"
                    ? (availableOptions as Group[]).map(g => (
                        <SelectItem key={g.id} value={g.id}>
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color || "#94a3b8" }} />
                            {g.name}
                          </span>
                        </SelectItem>
                      ))
                    : (availableOptions as Profile[]).map(p => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
              <Button size="sm" className="h-10 gap-1" disabled={!addId} onClick={() => handleAddPermission(selectedModule.id)}>
                <Plus className="h-4 w-4" /> Lägg till
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <Tabs defaultValue="permissions">
              <TabsList className="mb-4">
                <TabsTrigger value="permissions">Rättigheter</TabsTrigger>
                <TabsTrigger value="activity">Aktivitet</TabsTrigger>
              </TabsList>

              <TabsContent value="permissions" className="space-y-2">
                {modulePerms(selectedModule.id).length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">Inga rättigheter konfigurerade. Alla med rätt systemgrupp har grundåtkomst.</p>
                )}
                {modulePerms(selectedModule.id).map(perm => (
                  <div key={perm.id} className="flex items-center gap-3 rounded-xl bg-secondary/20 px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: getGranteeColor(perm) }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {perm.grantee_type === "group" ? <Users className="h-3 w-3 text-muted-foreground" /> : <User className="h-3 w-3 text-muted-foreground" />}
                          <span className="text-sm font-medium truncate">{getGranteeName(perm)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer" title="Visa">
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        <Switch checked={perm.can_view} onCheckedChange={v => handleToggle(perm.id, "can_view", v)} />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer" title="Redigera">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        <Switch checked={perm.can_edit} onCheckedChange={v => handleToggle(perm.id, "can_edit", v)} />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer" title="Ta bort">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <Switch checked={perm.can_delete} onCheckedChange={v => handleToggle(perm.id, "can_delete", v)} />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer" title="Ägare">
                        <Crown className="h-3.5 w-3.5 text-warning" />
                        <Switch checked={perm.is_owner} onCheckedChange={v => handleToggle(perm.id, "is_owner", v)} />
                      </label>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/50 hover:text-destructive" onClick={() => handleRemovePermission(perm.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="activity">
                {activityLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Ingen aktivitet registrerad ännu</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {activityLog.map(log => {
                      const profile = profiles.find(p => p.user_id === log.user_id);
                      return (
                        <div key={log.id} className="flex items-start gap-3 rounded-lg bg-secondary/20 px-3 py-2.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0 text-xs">
                            <span className="font-medium">{profile?.full_name || "Okänd"}</span>
                            <span className="text-muted-foreground"> {log.action} </span>
                            {log.entity_name && <span className="font-medium">"{log.entity_name}"</span>}
                            <p className="text-muted-foreground mt-0.5">
                              {new Date(log.created_at).toLocaleString("sv-SE")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
