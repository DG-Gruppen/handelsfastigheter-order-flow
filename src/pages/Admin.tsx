import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Shield } from "lucide-react";

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
          <Shield className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground mt-4">Du har inte behörighet att se denna sida</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Administration</h1>
          <p className="text-muted-foreground mt-1">Hantera användare och roller</p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Användare & Roller</CardTitle>
            <CardDescription>Tilldela roller till användare i systemet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {profiles.map((p) => (
                <div key={p.id} className="rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{p.full_name || p.email}</p>
                    <p className="text-sm text-muted-foreground">{p.email}</p>
                    <div className="flex gap-1.5 flex-wrap">
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
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Välj roll..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Anställd</SelectItem>
                        <SelectItem value="manager">Chef</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleAddRole(p.user_id)}>
                      <UserPlus className="h-3.5 w-3.5" />
                      Lägg till
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
