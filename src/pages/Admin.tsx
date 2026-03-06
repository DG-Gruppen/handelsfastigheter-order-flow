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
import { UserPlus, Shield, FolderOpen, Package, Users } from "lucide-react";

interface ProfileWithRoles {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string;
}

export default function Admin() {
  const { roles } = useAuth();
  const [profiles, setProfiles] = useState<ProfileWithRoles[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});

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

  return (
    <AppLayout>
      <div className="space-y-5 md:space-y-8">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">Administration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Hantera kategorier, utrustning, användare och roller</p>
        </div>

        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="categories" className="gap-1.5">
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Kategorier</span>
            </TabsTrigger>
            <TabsTrigger value="equipment" className="gap-1.5">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Utrustning</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Användare</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories">
            <CategoriesManager />
          </TabsContent>

          <TabsContent value="equipment">
            <OrderTypesManager />
          </TabsContent>

          <TabsContent value="users">
            <Card className="glass-card">
              <CardHeader className="px-4 md:px-6">
                <CardTitle className="font-heading text-base md:text-lg">Användare & Roller</CardTitle>
                <CardDescription className="text-sm">Tilldela roller till användare</CardDescription>
              </CardHeader>
              <CardContent className="px-4 md:px-6">
                <div className="space-y-3">
                  {profiles.map((p) => (
                    <div key={p.id} className="rounded-xl border border-border p-3.5 md:p-4 space-y-3">
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
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
