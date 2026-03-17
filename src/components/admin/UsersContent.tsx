import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  UserPlus, Shield, X, Upload, Loader2,
  Phone, Building2, Briefcase, Search, ArrowUpDown, Users,
} from "lucide-react";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  manager: "Chef",
  employee: "Anställd",
  staff: "Stab",
  it: "IT",
};

const roleColors: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  manager: "bg-warning/10 text-warning border-warning/20",
  employee: "bg-accent/10 text-accent border-accent/20",
  staff: "bg-primary/10 text-primary border-primary/20",
  it: "bg-primary/10 text-primary border-primary/20",
};

interface ProfileWithRoles {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string;
  phone: string | null;
  title_override: string | null;
  manager_id: string | null;
}

export default function UsersContent() {
  const [profiles, setProfiles] = useState<ProfileWithRoles[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterDept, setFilterDept] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [filterPhone, setFilterPhone] = useState("all");
  const [importing, setImporting] = useState(false);

  const fetchData = useCallback(async () => {
    const [{ data: profilesData }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.rpc("get_all_user_roles"),
    ]);
    setProfiles(((profilesData as ProfileWithRoles[]) ?? []).filter(p => p.email !== "toni@kazarian.se"));
    const roleMap: Record<string, string[]> = {};
    (rolesData ?? []).forEach((r: any) => {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
      roleMap[r.user_id].push(r.role);
    });
    setUserRoles(roleMap);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const departments = useMemo(() => {
    const depts = new Set(profiles.map(p => p.department).filter(Boolean));
    return [...depts].sort((a, b) => a.localeCompare(b, "sv"));
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = profiles.filter(p => {
      const matchesSearch = p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || (p.department ?? "").toLowerCase().includes(q) || (p.title_override ?? "").toLowerCase().includes(q);
      const matchesDept = filterDept === "all" || p.department === filterDept;
      const matchesRole = filterRole === "all" || (filterRole === "none" ? !(userRoles[p.user_id]?.length) : (userRoles[p.user_id] ?? []).includes(filterRole));
      const matchesPhone = filterPhone === "all" || (filterPhone === "yes" ? !!p.phone : !p.phone);
      return matchesSearch && matchesDept && matchesRole && matchesPhone;
    });
    return filtered.sort((a, b) => {
      const cmp = a.full_name.localeCompare(b.full_name, "sv");
      return sortAsc ? cmp : -cmp;
    });
  }, [profiles, searchQuery, sortAsc, filterDept, filterRole, filterPhone, userRoles]);

  const handleAddRole = async (userId: string) => {
    const role = selectedRole[userId];
    if (!role) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role } as any);
    if (error) {
      toast.error(error.code === "23505" ? "Användaren har redan den rollen" : "Kunde inte lägga till rollen");
    } else {
      toast.success("Roll tillagd");
      setUserRoles(prev => ({ ...prev, [userId]: [...(prev[userId] ?? []), role] }));
      setSelectedRole(prev => ({ ...prev, [userId]: "" }));
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
    if (error) {
      toast.error("Kunde inte ta bort rollen");
    } else {
      toast.success("Roll borttagen");
      setUserRoles(prev => ({ ...prev, [userId]: (prev[userId] ?? []).filter(r => r !== role) }));
    }
  };

  const handleGoogleWorkspaceImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const { data, error } = await supabase.functions.invoke("import-google-workspace", { body: json });
      if (error) throw error;
      const results = data?.results ?? [];
      const updated = results.filter((r: any) => r.status === "updated");
      const noMatch = results.filter((r: any) => r.status === "no_match");
      const noChanges = results.filter((r: any) => r.status === "no_changes");
      const errors = results.filter((r: any) => r.status === "error");
      toast.success(`Import klar: ${updated.length} uppdaterade, ${noChanges.length} redan aktuella, ${noMatch.length} utan matchning${errors.length ? `, ${errors.length} fel` : ""}`);
      fetchData();
    } catch (err: any) {
      toast.error("Import misslyckades: " + (err.message || "Okänt fel"));
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <Card className="glass-card border-t-2 border-t-warning/40">
      <CardHeader className="px-4 md:px-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-warning/10 shadow-sm shadow-warning/10">
            <Users className="h-4 w-4 md:h-5 md:w-5 text-warning" />
          </div>
          <div>
            <CardTitle className="font-heading text-base md:text-lg text-warning">Användare & Roller</CardTitle>
            <CardDescription className="text-xs">Tilldela roller till användare</CardDescription>
          </div>
        </div>
        <div className="pt-2">
          <label className="cursor-pointer">
            <input type="file" accept=".json" className="hidden" onChange={handleGoogleWorkspaceImport} disabled={importing} />
            <Button variant="outline" size="sm" className="gap-2" asChild disabled={importing}>
              <span>
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Importera från Google Workspace
              </span>
            </Button>
          </label>
        </div>
      </CardHeader>
      <CardContent className="px-4 md:px-6 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text" placeholder="Sök namn, e-post, avdelning..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full min-h-0 h-10 pl-9 pr-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setSortAsc(v => !v)} title={sortAsc ? "Sortering: A–Ö" : "Sortering: Ö–A"}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="h-9 w-auto min-w-[140px] text-xs">
              <Building2 className="h-3.5 w-3.5 mr-1.5 shrink-0" /><SelectValue placeholder="Avdelning" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla avdelningar</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="h-9 w-auto min-w-[120px] text-xs">
              <Shield className="h-3.5 w-3.5 mr-1.5 shrink-0" /><SelectValue placeholder="Roll" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla roller</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Chef</SelectItem>
              <SelectItem value="employee">Anställd</SelectItem>
              <SelectItem value="staff">Stab</SelectItem>
              <SelectItem value="it">IT</SelectItem>
              <SelectItem value="none">Utan roll</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPhone} onValueChange={setFilterPhone}>
            <SelectTrigger className="h-9 w-auto min-w-[130px] text-xs">
              <Phone className="h-3.5 w-3.5 mr-1.5 shrink-0" /><SelectValue placeholder="Telefon" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla</SelectItem>
              <SelectItem value="yes">Har telefonnummer</SelectItem>
              <SelectItem value="no">Saknar telefonnummer</SelectItem>
            </SelectContent>
          </Select>
          {(filterDept !== "all" || filterRole !== "all" || filterPhone !== "all") && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground"
              onClick={() => { setFilterDept("all"); setFilterRole("all"); setFilterPhone("all"); }}>
              Rensa filter
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{filteredProfiles.length} av {profiles.length} användare</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredProfiles.map(p => {
            const currentRoles = userRoles[p.user_id] ?? [];
            return (
              <div key={p.id} className="rounded-2xl border border-border/50 bg-secondary/30 p-3.5 md:p-4 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm md:text-base text-foreground">{p.full_name || p.email}</p>
                      {p.title_override && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Briefcase className="h-3 w-3 shrink-0" />{p.title_override}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    <span>{p.email}</span>
                    {p.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{p.phone}</span>}
                    {p.department && <span className="flex items-center gap-1"><Building2 className="h-3 w-3 shrink-0" />{p.department}</span>}
                  </div>
                  <div className="flex gap-1.5 flex-wrap pt-0.5">
                    {currentRoles.map(role => (
                      <Badge key={role} variant="outline" className={`capitalize text-xs gap-1 pr-1 ${roleColors[role] ?? ""}`}>
                        {roleLabels[role] ?? role}
                        <button onClick={() => handleRemoveRole(p.user_id, role)}
                          className="ml-0.5 rounded-full hover:bg-destructive/20 p-1.5 -mr-1 transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedRole[p.user_id] ?? ""} onValueChange={v => setSelectedRole(prev => ({ ...prev, [p.user_id]: v }))}>
                    <SelectTrigger className="flex-1 h-11 md:h-10 md:w-[160px] md:flex-none">
                      <SelectValue placeholder="Välj roll..." />
                    </SelectTrigger>
                    <SelectContent>
                      {!currentRoles.includes("employee") && <SelectItem value="employee" className="py-3 md:py-2">Anställd</SelectItem>}
                      {!currentRoles.includes("manager") && <SelectItem value="manager" className="py-3 md:py-2">Chef</SelectItem>}
                      {!currentRoles.includes("staff") && <SelectItem value="staff" className="py-3 md:py-2">Stab</SelectItem>}
                      {!currentRoles.includes("it") && <SelectItem value="it" className="py-3 md:py-2">IT</SelectItem>}
                      {!currentRoles.includes("admin") && <SelectItem value="admin" className="py-3 md:py-2">Admin</SelectItem>}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="gap-1.5 h-11 md:h-10 shrink-0" onClick={() => handleAddRole(p.user_id)}>
                    <UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Lägg till</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
