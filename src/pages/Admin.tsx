import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import OrderTypesManager from "@/components/OrderTypesManager";
import CategoriesManager from "@/components/CategoriesManager";
import SystemsManager from "@/components/SystemsManager";
import ModulesManager from "@/components/ModulesManager";
import KbAdminPanel from "@/components/kb/KbAdminPanel";
import AdminDashboard from "@/components/admin/AdminDashboard";
import ImpersonateUserCard from "@/components/admin/ImpersonateUserCard";
import GroupsManager from "@/components/admin/GroupsManager";
import ModulePermissionsManager from "@/components/admin/ModulePermissionsManager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  UserPlus, Shield, FolderOpen, Package, Users, ChevronLeft, X, Upload, Loader2,
  Phone, Building2, Briefcase, Search, ArrowUpDown, Settings, Monitor, Link2,
  Palette, Wrench, LayoutGrid, BookOpen, ShoppingCart, Cog, Activity
} from "lucide-react";


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

type AdminSection = "menu" | "categories" | "equipment" | "systems" | "users" | "settings" | "it" | "modules" | "knowledge" | "groups" | "permissions";

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

interface AdminGroup {
  label: string;
  icon: React.ElementType;
  color: string;
  items: AdminItem[];
}

interface AdminItem {
  id: AdminSection;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  roles?: string[];
}

const adminGroups: AdminGroup[] = [
  {
    label: "Beställningar",
    icon: ShoppingCart,
    color: "text-accent",
    items: [
      {
        id: "categories", label: "Kategorier", description: "Skapa och hantera beställningskategorier",
        icon: FolderOpen, color: "from-primary to-primary-glow", borderColor: "border-t-primary/40",
        bgColor: "bg-primary/10", textColor: "text-primary",
      },
      {
        id: "equipment", label: "Utrustning", description: "Hantera beställningsbar utrustning",
        icon: Package, color: "from-accent to-accent", borderColor: "border-t-accent/40",
        bgColor: "bg-accent/10", textColor: "text-accent",
      },
      {
        id: "systems", label: "System & Licenser", description: "Hantera system för on-/offboarding",
        icon: Monitor, color: "from-accent to-accent", borderColor: "border-t-accent/40",
        bgColor: "bg-accent/10", textColor: "text-accent",
      },
    ],
  },
  {
    label: "Innehåll",
    icon: BookOpen,
    color: "text-primary",
    items: [
      {
        id: "knowledge", label: "Kunskapsbanken", description: "Artiklar, videor och kategorier",
        icon: BookOpen, color: "from-primary to-primary-glow", borderColor: "border-t-primary/40",
        bgColor: "bg-primary/10", textColor: "text-primary",
      },
    ],
  },
  {
    label: "Organisation",
    icon: Users,
    color: "text-warning",
    items: [
      {
        id: "users", label: "Användare & Roller", description: "Tilldela roller till användare",
        icon: Users, color: "from-warning to-warning", borderColor: "border-t-warning/40",
        bgColor: "bg-warning/10", textColor: "text-warning",
      },
      {
        id: "groups", label: "Grupper", description: "Skapa och hantera grupper",
        icon: Users, color: "from-primary to-primary-glow", borderColor: "border-t-primary/40",
        bgColor: "bg-primary/10", textColor: "text-primary",
      },
    ],
  },
  {
    label: "Systeminställningar",
    icon: Cog,
    color: "text-muted-foreground",
    items: [
      {
        id: "modules", label: "Moduler", description: "Hantera moduler och synlighet",
        icon: LayoutGrid, color: "from-primary to-primary-glow", borderColor: "border-t-primary/40",
        bgColor: "bg-primary/10", textColor: "text-primary",
      },
      {
        id: "permissions", label: "Modulrättigheter", description: "Styr åtkomst per modul",
        icon: Shield, color: "from-accent to-accent", borderColor: "border-t-accent/40",
        bgColor: "bg-accent/10", textColor: "text-accent",
      },
      {
        id: "settings", label: "Inställningar", description: "Attestering och andra inställningar",
        icon: Settings, color: "from-muted-foreground to-muted-foreground", borderColor: "border-t-muted-foreground/30",
        bgColor: "bg-muted-foreground/10", textColor: "text-muted-foreground",
      },
      {
        id: "it", label: "IT", description: "Navigationslänkar och utseende",
        icon: Wrench, color: "from-primary to-primary-glow", borderColor: "border-t-primary/40",
        bgColor: "bg-primary/10", textColor: "text-primary",
        roles: ["it", "admin"],
      },
    ],
  },
];

export default function Admin() {
  const { roles } = useAuth();
  
  const [profiles, setProfiles] = useState<ProfileWithRoles[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<AdminSection>("menu");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterPhone, setFilterPhone] = useState<string>("all");

  const departments = useMemo(() => {
    const depts = new Set(profiles.map((p) => p.department).filter(Boolean));
    return [...depts].sort((a, b) => a.localeCompare(b, "sv"));
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = profiles.filter((p) => {
      const matchesSearch =
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.department ?? "").toLowerCase().includes(q) ||
        (p.title_override ?? "").toLowerCase().includes(q);
      const matchesDept = filterDept === "all" || p.department === filterDept;
      const matchesRole =
        filterRole === "all" ||
        (filterRole === "none"
          ? !(userRoles[p.user_id]?.length)
          : (userRoles[p.user_id] ?? []).includes(filterRole));
      const matchesPhone =
        filterPhone === "all" ||
        (filterPhone === "yes" ? !!p.phone : !p.phone);
      return matchesSearch && matchesDept && matchesRole && matchesPhone;
    });
    return filtered.sort((a, b) => {
      const cmp = a.full_name.localeCompare(b.full_name, "sv");
      return sortAsc ? cmp : -cmp;
    });
  }, [profiles, searchQuery, sortAsc, filterDept, filterRole, filterPhone, userRoles]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: profilesData } = await supabase.from("profiles").select("*");
      setProfiles(((profilesData as ProfileWithRoles[]) ?? []).filter(p => p.email !== "toni@kazarian.se"));

      const { data: rolesData } = await supabase.rpc("get_all_user_roles");
      const roleMap: Record<string, string[]> = {};
      (rolesData ?? []).forEach((r: any) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      });
      setUserRoles(roleMap);
    };
    fetchData();
  }, []);

  const handleAddRole = async (userId: string) => {
    const role = selectedRole[userId];
    if (!role) return;

    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role } as any);
    if (error) {
      if (error.code === "23505") toast.error("Användaren har redan den rollen");
      else toast.error("Kunde inte lägga till rollen");
    } else {
      toast.success("Roll tillagd");
      setUserRoles((prev) => ({
        ...prev,
        [userId]: [...(prev[userId] ?? []), role],
      }));
      setSelectedRole((prev) => ({ ...prev, [userId]: "" }));
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role as any);
    if (error) {
      toast.error("Kunde inte ta bort rollen");
    } else {
      toast.success("Roll borttagen");
      setUserRoles((prev) => ({
        ...prev,
        [userId]: (prev[userId] ?? []).filter((r) => r !== role),
      }));
    }
  };

  const [importing, setImporting] = useState(false);
  const [allSettings, setAllSettings] = useState<Record<string, string>>({});

  const NAV_LINKS = [
    { key: "nav_dashboard", label: "Dashboard", description: "Startsida med översikt" },
    { key: "nav_new_order", label: "Ny beställning", description: "Formulär för ny beställning" },
    { key: "nav_onboarding", label: "On-/Offboarding", description: "Formulär för nyanställning och avslut" },
    { key: "nav_approvals", label: "Att attestera", description: "Attesteringssida (chefer/admin)" },
    { key: "nav_history", label: "Historik", description: "Orderhistorik" },
    { key: "nav_it_info", label: "IT-support", description: "IT-informationssida" },
    { key: "nav_org", label: "Organisation", description: "Organisationsträd (admin)" },
    { key: "nav_admin", label: "Admin", description: "Administrationspanel (admin)" },
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("org_chart_settings")
        .select("setting_key, setting_value");
      const map: Record<string, string> = {};
      for (const s of (data as any[]) ?? []) map[s.setting_key] = s.setting_value;
      setAllSettings(map);
    };
    fetchSettings();
  }, []);

  const upsertSetting = async (key: string, value: string) => {
    await supabase
      .from("org_chart_settings")
      .upsert({ setting_key: key, setting_value: value, updated_at: new Date().toISOString() } as any, { onConflict: "setting_key" });
    setAllSettings(prev => ({ ...prev, [key]: value }));
    toast.success("Inställning uppdaterad");
  };

  const toggleSetting = async (key: string, defaultOn = true) => {
    const current = defaultOn ? allSettings[key] !== "false" : allSettings[key] === "true";
    await upsertSetting(key, current ? "false" : "true");
  };

  const isOn = (key: string, defaultOn = true) =>
    defaultOn ? allSettings[key] !== "false" : allSettings[key] === "true";

  const handleGoogleWorkspaceImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const { data, error } = await supabase.functions.invoke("import-google-workspace", {
        body: json,
      });

      if (error) throw error;

      const results = data?.results ?? [];
      const updated = results.filter((r: any) => r.status === "updated");
      const noMatch = results.filter((r: any) => r.status === "no_match");
      const noChanges = results.filter((r: any) => r.status === "no_changes");
      const errors = results.filter((r: any) => r.status === "error");

      toast.success(
        `Import klar: ${updated.length} uppdaterade, ${noChanges.length} redan aktuella, ${noMatch.length} utan matchning${errors.length ? `, ${errors.length} fel` : ""}`
      );

      const { data: profilesData } = await supabase.from("profiles").select("*");
      setProfiles((profilesData as ProfileWithRoles[]) ?? []);
    } catch (err: any) {
      toast.error("Import misslyckades: " + (err.message || "Okänt fel"));
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  if (!roles.includes("admin")) {
    return (
      <div className="text-center py-20">
        <Shield className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground mt-4">Du har inte behörighet att se denna sida</p>
      </div>
    );
  }

  // Filter groups/items by role
  const visibleGroups = adminGroups
    .map(g => ({
      ...g,
      items: g.items.filter(item => !item.roles || item.roles.some(r => roles.includes(r))),
    }))
    .filter(g => g.items.length > 0);

  const allItems = visibleGroups.flatMap(g => g.items);
  const activeItem = allItems.find(i => i.id === activeSection);

  const renderSection = (sectionId: AdminSection) => {
    switch (sectionId) {
      case "categories": return <CategoriesManager />;
      case "equipment": return <OrderTypesManager />;
      case "systems": return <SystemsManager />;
      case "users": return <UsersContent />;
      case "settings": return <SettingsContent />;
      case "it": return <ITContent />;
      case "modules": return <ModulesManager onClose={() => setActiveSection("menu")} />;
      case "knowledge": return <KbAdminPanel onDataChange={() => {}} />;
      case "groups": return <GroupsManager />;
      case "permissions": return <ModulePermissionsManager />;
      default: return null;
    }
  };

  function UsersContent() {
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
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-0 h-10 pl-9 pr-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setSortAsc((v) => !v)} title={sortAsc ? "Sortering: A–Ö" : "Sortering: Ö–A"}>
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
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
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
            {filteredProfiles.map((p) => {
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
                      {currentRoles.map((role) => (
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
                    <Select value={selectedRole[p.user_id] ?? ""} onValueChange={(v) => setSelectedRole((prev) => ({ ...prev, [p.user_id]: v }))}>
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

  function SettingsContent() {
    return (
      <div className="space-y-6">
        <Card className="glass-card border-t-2 border-t-muted-foreground/30">
          <CardHeader className="px-4 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-muted-foreground/10 shadow-sm">
                <Settings className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="font-heading text-base md:text-lg">Attesteringsinställningar</CardTitle>
                <CardDescription className="text-xs">Styr vilka beställningar som ska attesteras av VD</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6 space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/20 p-3 md:p-4">
              <div className="min-w-0 mr-2">
                <p className="text-sm font-medium text-foreground">Chefers beställningar attesteras av VD</p>
                <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">Chefer kan inte godkänna sina egna beställningar</p>
              </div>
              <Switch checked={allSettings["approval_managers_to_ceo"] === "true"} onCheckedChange={() => toggleSetting("approval_managers_to_ceo", false)} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/20 p-3 md:p-4">
              <div className="min-w-0 mr-2">
                <p className="text-sm font-medium text-foreground">Stabs beställningar attesteras av VD</p>
                <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">Stabsmedarbetare skickas till VD istället</p>
              </div>
              <Switch checked={allSettings["approval_staff_to_ceo"] === "true"} onCheckedChange={() => toggleSetting("approval_staff_to_ceo", false)} />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function ITContent() {
    return (
      <div className="space-y-6">
        <ImpersonateUserCard
          profiles={profiles.map((p) => ({
            user_id: p.user_id,
            full_name: p.full_name,
            email: p.email,
            department: p.department,
          }))}
        />
        <Card className="glass-card border-t-2 border-t-primary/40">
          <CardHeader className="px-4 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-primary/10 shadow-sm shadow-primary/10">
                <Link2 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="font-heading text-base md:text-lg text-primary">Navigationslänkar</CardTitle>
                <CardDescription className="text-xs">Styr vilka sidor som visas och är tillgängliga</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {NAV_LINKS.map((link) => (
                <div key={link.key} className="flex items-center justify-between rounded-xl border border-primary/10 bg-primary/[0.03] p-3 hover:bg-primary/[0.06] transition-colors">
                  <div className="min-w-0 mr-2">
                    <p className="text-sm font-medium text-foreground">{link.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{link.description}</p>
                  </div>
                  <Switch checked={isOn(link.key)} onCheckedChange={() => toggleSetting(link.key)} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-t-2 border-t-accent/40">
          <CardHeader className="px-4 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-accent/10 shadow-sm shadow-accent/10">
                <Palette className="h-4 w-4 md:h-5 md:w-5 text-accent" />
              </div>
              <div>
                <CardTitle className="font-heading text-base md:text-lg text-accent">Utseende</CardTitle>
                <CardDescription className="text-xs">Standardtema för nya användare</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="flex items-center justify-between rounded-xl border border-accent/10 bg-accent/[0.03] p-3 md:p-4 hover:bg-accent/[0.06] transition-colors">
              <div className="min-w-0 mr-2">
                <p className="text-sm font-medium text-foreground">Tema för nya användare</p>
                <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
                  Nuvarande: {(allSettings["it_default_theme"] || "light") === "light" ? "Ljust" : "Mörkt"}
                </p>
              </div>
              <Select value={allSettings["it_default_theme"] || "light"} onValueChange={(v) => upsertSetting("it_default_theme", v)}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Ljust</SelectItem>
                  <SelectItem value="dark">Mörkt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mobile & Tablet: card-based navigation (< 1024px)
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.innerWidth < 1024);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setCompact(mql.matches);
    mql.addEventListener("change", onChange);
    setCompact(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  if (compact) {
    return (
      <div className="space-y-5">
        {activeSection === "menu" ? (
          <>
            <div>
              <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">Administration</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Centralt administrationsgränssnitt</p>
            </div>
            {/* Only show dashboard on tablet landscape and up (min-width: 1024px) */}
            <div className="hidden lg:block">
              <AdminDashboard onNavigate={(s) => setActiveSection(s as AdminSection)} />
            </div>
            <div className="space-y-6 md:mt-6">
              {visibleGroups.map((group) => (
                <div key={group.label} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <group.icon className={`h-4 w-4 ${group.color}`} />
                    <h2 className={`text-xs font-semibold uppercase tracking-wider ${group.color}`}>{group.label}</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {group.items.map((s, i) => (
                      <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        className="glass-card rounded-2xl p-4 flex items-center gap-4 text-left active:scale-[0.98] transition-all animate-fade-up"
                        style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
                      >
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} shadow-lg`}>
                          <s.icon className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-heading font-semibold text-sm text-foreground">{s.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveSection("menu")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -mb-2 min-h-[44px] active:scale-[0.95]"
            >
              <ChevronLeft className="h-4 w-4" />
              Tillbaka
            </button>
            {renderSection(activeSection)}
          </>
        )}
      </div>
    );
  }

  // Desktop: sidebar + content
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Administration</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Centralt administrationsgränssnitt för hela systemet</p>
      </div>

      <div className="flex gap-6 min-h-[600px]">
        {/* Content area */}
        <div className="flex-1 min-w-0">
          {activeSection === "menu" ? (
            <AdminDashboard onNavigate={(s) => setActiveSection(s as AdminSection)} />
          ) : (
            renderSection(activeSection)
          )}
        </div>

        {/* Sidebar navigation */}
        <nav className="w-56 shrink-0 space-y-5">
          <button
            onClick={() => setActiveSection("menu")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left ${
              activeSection === "menu"
                ? "bg-primary/10 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Activity className="h-4 w-4 shrink-0" />
            Dashboard
          </button>
          {visibleGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="flex items-center gap-2 px-3 py-1.5 select-none pointer-events-none rounded-lg bg-secondary/60 mb-1">
                <group.icon className="h-3.5 w-3.5 text-warning" />
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-warning">{group.label}</span>
              </div>
              {group.items.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left ${
                      isActive
                        ? `${item.bgColor} ${item.textColor} shadow-sm`
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
