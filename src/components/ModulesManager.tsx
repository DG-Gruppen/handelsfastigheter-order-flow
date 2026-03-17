import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

import { toast } from "sonner";
import { LayoutGrid, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getModuleIcon } from "@/lib/moduleIcons";

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

export default function ModulesManager({ onClose }: { onClose?: () => void }) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const { data } = await supabase.from("modules").select("*").order("sort_order");
    setModules((data as Module[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleModuleActive = async (moduleId: string, current: boolean) => {
    await supabase.from("modules").update({ is_active: !current } as any).eq("id", moduleId);
    toast.success(!current ? "Modul aktiverad" : "Modul inaktiverad");
    fetchData();
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

            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
