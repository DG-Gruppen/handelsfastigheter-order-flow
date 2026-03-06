import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import OrderTypesManager from "@/components/OrderTypesManager";
import CategoriesManager from "@/components/CategoriesManager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Shield, FolderOpen, Package, Users, ChevronLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ProfileWithRoles {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string;
}

type AdminSection = "menu" | "categories" | "equipment" | "users";

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
];

export default function Admin() {
  const { roles } = useAuth();
  const isMobile = useIsMobile();
  const [profiles, setProfiles] = useState<ProfileWithRoles[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<AdminSection>("menu");

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
      </CardHeader>
      <CardContent className="px-4 md:px-6">
        <div className="space-y-3">
          {profiles.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border/50 bg-secondary/30 p-3.5 md:p-4 space-y-3">
              <div className="space-y-1">
                <p className="font-medium text-sm md:text-base text-foreground">
                  {p.full_name || p.email}
                </p>
                <p className="text-xs text-muted-foreground">{p.email}</p>
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {(userRoles[p.user_id] ?? []).map((role) => (
                    <Badge key={role} variant="secondary" className="capitalize text-xs">
                      {role}
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
                    <SelectItem value="employee" className="py-3 md:py-2">Anställd</SelectItem>
                    <SelectItem value="manager" className="py-3 md:py-2">Chef</SelectItem>
                    <SelectItem value="admin" className="py-3 md:py-2">Admin</SelectItem>
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
          ))}
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
                {sections.map((s, i) => (
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
          <TabsList className="glass-card w-full justify-start p-1 h-auto">
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
        </Tabs>
      </div>
    </AppLayout>
  );
}
