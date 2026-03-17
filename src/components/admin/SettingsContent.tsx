import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Settings } from "lucide-react";

export default function SettingsContent() {
  const [allSettings, setAllSettings] = useState<Record<string, string>>({});

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from("org_chart_settings").select("setting_key, setting_value");
    const map: Record<string, string> = {};
    for (const s of (data as any[]) ?? []) map[s.setting_key] = s.setting_value;
    setAllSettings(map);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const toggleSetting = async (key: string, defaultOn = true) => {
    const current = defaultOn ? allSettings[key] !== "false" : allSettings[key] === "true";
    const value = current ? "false" : "true";
    await supabase.from("org_chart_settings").upsert({ setting_key: key, setting_value: value, updated_at: new Date().toISOString() } as any, { onConflict: "setting_key" });
    setAllSettings(prev => ({ ...prev, [key]: value }));
    toast.success("Inställning uppdaterad");
  };

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
