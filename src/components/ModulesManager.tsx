import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

import { toast } from "sonner";
import { LayoutGrid, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getModuleIcon } from "@/lib/moduleIcons";

const ALL_ROLES = ["admin", "manager", "employee", "staff", "it"] as const;
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Chef",
  employee: "Anställd",
  staff: "Stab",
  it: "IT",
};
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive",
  manager: "bg-warning/10 text-warning",
  employee: "bg-accent/10 text-accent",
  staff: "bg-primary/10 text-primary",
  it: "bg-primary/10 text-primary",
};

interface Module {
  id: string;
  name: string;
  slug: string;
  route: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  description: string;
}

interface Access {
  id?: string;
  module_id: string;
  role: string;
  has_access: boolean;
}

export default function ModulesManager({ onClose }: { onClose?: () => void }) {
  const [modules, setModules] = useState<Module[]>([]);
  const [access, setAccess] = useState<Access[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [modRes, accessRes] = await Promise.all([
      supabase.from("modules").select("*").order("sort_order"),
      supabase.from("module_role_access").select("*"),
    ]);
    setModules((modRes.data as Module[]) ?? []);
    setAccess((accessRes.data as Access[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleModuleActive = async (moduleId: string, current: boolean) => {
    await supabase.from("modules").update({ is_active: !current } as any).eq("id", moduleId);
    toast.success(!current ? "Modul aktiverad" : "Modul inaktiverad");
    fetchData();
  };

  const toggleRoleAccess = async (moduleId: string, role: string) => {
    const existing = access.find((a) => a.module_id === moduleId && a.role === role);
    if (existing) {
      await supabase
        .from("module_role_access")
        .update({ has_access: !existing.has_access } as any)
        .eq("module_id", moduleId)
        .eq("role", role as any);
    } else {
      await supabase.from("module_role_access").insert({
        module_id: moduleId,
        role: role as any,
        has_access: true,
      } as any);
    }
    fetchData();
  };

  const hasAccess = (moduleId: string, role: string): boolean => {
    const rule = access.find((a) => a.module_id === moduleId && a.role === role);
    return rule ? rule.has_access : false;
  };

  if (loading) {
    return <p className="text-muted-foreground py-8 text-center">Laddar...</p>;
  }

  return (
    <Card className="glass-card border-t-2 border-t-primary/40">
      <CardHeader className="px-4 md:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shadow-sm shadow-primary/10">
              <LayoutGrid className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="font-heading text-base md:text-lg text-primary">Modulhantering</CardTitle>
              <CardDescription className="text-xs">Hantera moduler och behörigheter per roll</CardDescription>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-10 w-10 text-primary hover:bg-primary/10" onClick={onClose}>
              <Check className="h-5 w-5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 md:px-6 space-y-3">
        {modules.map((mod) => {
          const Icon = getModuleIcon(mod.icon);
          return (
            <div key={mod.id} className="rounded-xl border border-border p-4 bg-card space-y-3">
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{mod.name}</span>
                    <span className="text-[10px] text-muted-foreground">{mod.route}</span>
                  </div>
                  {mod.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{mod.is_active ? "Aktiv" : "Inaktiv"}</span>
                  <Switch checked={mod.is_active} onCheckedChange={() => toggleModuleActive(mod.id, mod.is_active)} />
                </div>
              </div>

              {mod.is_active && (
                <div className="flex flex-wrap gap-2">
                  {ALL_ROLES.map((role) => {
                    const active = hasAccess(mod.id, role);
                    return (
                      <button
                        key={role}
                        onClick={() => toggleRoleAccess(mod.id, role)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          active
                            ? ROLE_COLORS[role] + " ring-1 ring-current/20"
                            : "bg-muted text-muted-foreground opacity-50 hover:opacity-75"
                        }`}
                      >
                        {ROLE_LABELS[role]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
