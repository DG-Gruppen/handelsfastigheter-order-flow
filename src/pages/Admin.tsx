import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import OrderTypesManager from "@/components/OrderTypesManager";
import CategoriesManager from "@/components/CategoriesManager";
import ITSettingsManager from "@/components/ITSettingsManager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Shield, FolderOpen, Package, Users, ChevronLeft, X, Upload, Loader2, Phone, Building2, Briefcase, Search, ArrowUpDown, Settings, Wrench } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";

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

type AdminSection = "menu" | "categories" | "equipment" | "users" | "settings" | "it";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  manager: "Chef",
  employee: "Anställd",
  staff: "Stab",
  it: "IT",
};

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  manager: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  employee: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  staff: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  it: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
};

const sections = [
  {
    id: "categories" as const,
    label: "Kategorier",
    description: "Skapa och hantera kategorier",
    icon: FolderOpen,
    color: "from-primary to-primary-glow",
  },
  {
    id: "equipment" as const,
    label: "Utrustning",
    description: "Hantera beställningsbar utrustning",
    icon: Package,
    color: "from-accent to-accent",
  },
  {
    id: "users" as const,
    label: "Användare & Roller",
    description: "Tilldela roller till användare",
    icon: Users,
    color: "from-warning to-warning",
  },
  {
    id: "settings" as const,
    label: "Inställningar",
    description: "Attestering och andra inställningar",
    icon: Settings,
    color: "from-muted-foreground to-muted-foreground",
  },
  {
    id: "it" as const,
    label: "IT",
    description: "IT-specifika inställningar",
    icon: Wrench,
    color: "from-blue-500 to-blue-600",
    roles: ["it", "admin"] as string[],
  },
];

export default function Admin() {
  const { roles } = useAuth();
  const isMobile = useIsMobile();
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
      setProfiles((profilesData as ProfileWithRoles[]) ?? []);

      const { data: rolesData } = await supabase.from("user_roles").select("*");
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
  const [approvalSettings, setApprovalSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchApprovalSettings = async () => {
      const { data } = await supabase
        .from("org_chart_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["approval_managers_to_ceo", "approval_staff_to_ceo"]);
      const map: Record<string, string> = {};
      for (const s of (data as any[]) ?? []) map[s.setting_key] = s.setting_value;
      setApprovalSettings(map);
    };
    fetchApprovalSettings();
  }, []);

  const toggleApprovalSetting = async (key: string) => {
    const current = approvalSettings[key] === "true";
    const newValue = current ? "false" : "true";
    await supabase
      .from("org_chart_settings")
      .upsert({ setting_key: key, setting_value: newValue, updated_at: new Date().toISOString() } as any, { onConflict: "setting_key" });
    setApprovalSettings(prev => ({ ...prev, [key]: newValue }));
    toast.success("Inställning uppdaterad");
  };

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

      // Refresh profiles
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
      <AppLayout>
        <div className="text-center py-20">
          <Shield className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mt-4">Du har inte behörighet att se denna sida</p>
        </div>
      </AppLayout>
    );
  }

  const UsersContent = (
    <Card className="glass-card animate-fade-up">
      <CardHeader className="px-4 md:px-6">
        <CardTitle className="font-heading text-base md:text-lg">Användare & Roller</CardTitle>
        <CardDescription className="text-sm">Tilldela roller till användare</CardDescription>
        <div className="pt-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleGoogleWorkspaceImport}
              disabled={importing}
            />
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
              type="text"
              placeholder="Sök namn, e-post, avdelning..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => setSortAsc((v) => !v)}
            title={sortAsc ? "Sortering: A–Ö" : "Sortering: Ö–A"}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="h-9 w-auto min-w-[140px] text-xs">
              <Building2 className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <SelectValue placeholder="Avdelning" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla avdelningar</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="h-9 w-auto min-w-[120px] text-xs">
              <Shield className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <SelectValue placeholder="Roll" />
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
              <Phone className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <SelectValue placeholder="Telefon" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla</SelectItem>
              <SelectItem value="yes">Har telefonnummer</SelectItem>
              <SelectItem value="no">Saknar telefonnummer</SelectItem>
            </SelectContent>
          </Select>
          {(filterDept !== "all" || filterRole !== "all" || filterPhone !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-muted-foreground"
              onClick={() => { setFilterDept("all"); setFilterRole("all"); setFilterPhone("all"); }}
            >
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
                    <p className="font-medium text-sm md:text-base text-foreground">
                      {p.full_name || p.email}
                    </p>
                    {p.title_override && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Briefcase className="h-3 w-3 shrink-0" />
                        {p.title_override}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  <span>{p.email}</span>
                  {p.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3 shrink-0" />
                      {p.phone}
                    </span>
                  )}
                  {p.department && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {p.department}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5 flex-wrap pt-0.5">
                  {(userRoles[p.user_id] ?? []).map((role) => (
                    <Badge key={role} variant="outline" className={`capitalize text-xs gap-1 pr-1 ${roleColors[role] ?? ""}`}>
                      {roleLabels[role] ?? role}
                      <button
                        onClick={() => handleRemoveRole(p.user_id, role)}
                        className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedRole[p.user_id] ?? ""}
                  onValueChange={(v) => setSelectedRole((prev) => ({ ...prev, [p.user_id]: v }))}
                >
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
                <Button
                  variant="outline"
                  className="gap-1.5 h-11 md:h-10 shrink-0"
                  onClick={() => handleAddRole(p.user_id)}
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Lägg till</span>
                </Button>
              </div>
            </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  const SettingsContent = (
    <Card className="glass-card animate-fade-up">
      <CardHeader className="px-4 md:px-6">
        <CardTitle className="font-heading text-base md:text-lg">Attesteringsinställningar</CardTitle>
        <CardDescription className="text-sm">Styr vilka beställningar som ska attesteras av VD</CardDescription>
      </CardHeader>
      <CardContent className="px-4 md:px-6 space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/20 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Chefers beställningar attesteras av VD</p>
            <p className="text-xs text-muted-foreground mt-0.5">Chefer kan inte godkänna sina egna beställningar utan skickas till VD</p>
          </div>
          <Switch
            checked={approvalSettings["approval_managers_to_ceo"] === "true"}
            onCheckedChange={() => toggleApprovalSetting("approval_managers_to_ceo")}
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/20 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Stabs beställningar attesteras av VD</p>
            <p className="text-xs text-muted-foreground mt-0.5">Stabsmedarbetare kan inte godkänna sina egna beställningar utan skickas till VD</p>
          </div>
          <Switch
            checked={approvalSettings["approval_staff_to_ceo"] === "true"}
            onCheckedChange={() => toggleApprovalSetting("approval_staff_to_ceo")}
          />
        </div>
      </CardContent>
    </Card>
  );

  // Mobile: card-based navigation
  if (isMobile) {
    return (
      <AppLayout>
        <div className="space-y-5">
          {activeSection === "menu" ? (
            <>
              <div>
                <h1 className="font-heading text-xl font-bold text-foreground">Administration</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Hantera systemet</p>
              </div>
              <div className="grid gap-3">
                {sections.filter(s => !(s as any).roles || (s as any).roles.some((r: string) => roles.includes(r))).map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className="glass-card rounded-2xl p-4 flex items-center gap-4 text-left active:scale-[0.98] transition-all animate-fade-up"
                    style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
                  >
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${s.color} shadow-lg`}>
                      <s.icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-heading font-semibold text-foreground">{s.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveSection("menu")}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -mb-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Tillbaka
              </button>
              {activeSection === "categories" && <CategoriesManager />}
              {activeSection === "equipment" && <OrderTypesManager />}
              {activeSection === "users" && UsersContent}
              {activeSection === "settings" && SettingsContent}
            </>
          )}
        </div>
      </AppLayout>
    );
  }

  // Desktop: tabs
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Administration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Hantera kategorier, utrustning, användare och roller</p>
        </div>

        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="glass-card w-full grid grid-cols-4 p-1 h-auto">
            {sections.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="gap-2 py-2.5 px-4 data-[state=active]:shadow-md">
                <s.icon className="h-4 w-4" />
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="categories" className="mt-4">
            <CategoriesManager />
          </TabsContent>

          <TabsContent value="equipment" className="mt-4">
            <OrderTypesManager />
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            {UsersContent}
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            {SettingsContent}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
