import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Link2 } from "lucide-react";

const NAV_LINKS = [
  { key: "nav_dashboard", label: "Dashboard", description: "Startsida med översikt" },
  { key: "nav_new_order", label: "Ny beställning", description: "Formulär för ny beställning" },
  { key: "nav_approvals", label: "Att attestera", description: "Attesteringssida (chefer/admin)" },
  { key: "nav_history", label: "Historik", description: "Orderhistorik" },
  { key: "nav_org", label: "Organisation", description: "Organisationsträd (admin)" },
  { key: "nav_admin", label: "Admin", description: "Administrationspanel (admin)" },
];

export default function ITSettingsManager() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("org_chart_settings")
        .select("setting_key, setting_value")
        .like("setting_key", "nav_%");
      const map: Record<string, string> = {};
      for (const s of (data as any[]) ?? []) map[s.setting_key] = s.setting_value;
      setSettings(map);
      setLoading(false);
    };
    fetch();
  }, []);

  const toggleSetting = async (key: string) => {
    const current = settings[key] !== "false"; // default visible
    const newValue = current ? "false" : "true";
    await supabase
      .from("org_chart_settings")
      .upsert(
        { setting_key: key, setting_value: newValue, updated_at: new Date().toISOString() } as any,
        { onConflict: "setting_key" }
      );
    setSettings((prev) => ({ ...prev, [key]: newValue }));
    toast.success("Inställning uppdaterad");
  };

  const isVisible = (key: string) => settings[key] !== "false";

  return (
    <Card className="glass-card animate-fade-up">
      <CardHeader className="px-4 md:px-6">
        <CardTitle className="font-heading text-base md:text-lg">IT-inställningar</CardTitle>
        <CardDescription className="text-sm">Inställningar som hanteras av IT-avdelningen</CardDescription>
      </CardHeader>
      <CardContent className="px-4 md:px-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Synliga navigationslänkar</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Styr vilka länkar som visas i headern för alla användare. Dolda länkar är fortfarande tillgängliga via direktlänk.
          </p>
          <div className="space-y-2">
            {NAV_LINKS.map((link) => (
              <div
                key={link.key}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/20 p-4"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{link.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{link.description}</p>
                </div>
                <Switch
                  checked={isVisible(link.key)}
                  onCheckedChange={() => toggleSetting(link.key)}
                  disabled={loading}
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
