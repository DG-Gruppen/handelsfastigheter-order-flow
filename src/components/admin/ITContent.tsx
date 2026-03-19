import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import ImpersonateUserCard from "@/components/admin/ImpersonateUserCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Link2, Palette } from "lucide-react";

interface SimpleProfile {
  user_id: string;
  full_name: string;
  email: string;
  department: string;
}

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

export default function ITContent() {
  const [profiles, setProfiles] = useState<SimpleProfile[]>([]);
  const [allSettings, setAllSettings] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    const [{ data: profs }, { data: settings }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email, department"),
      supabase.from("org_chart_settings").select("setting_key, setting_value"),
    ]);
    setProfiles(((profs as SimpleProfile[]) ?? []).filter(p => !(p as any).is_hidden));
    const map: Record<string, string> = {};
    for (const s of (settings as any[]) ?? []) map[s.setting_key] = s.setting_value;
    setAllSettings(map);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const upsertSetting = async (key: string, value: string) => {
    await supabase.from("org_chart_settings").upsert({ setting_key: key, setting_value: value, updated_at: new Date().toISOString() } as any, { onConflict: "setting_key" });
    setAllSettings(prev => ({ ...prev, [key]: value }));
    toast.success("Inställning uppdaterad");
  };

  const toggleSetting = async (key: string, defaultOn = true) => {
    const current = defaultOn ? allSettings[key] !== "false" : allSettings[key] === "true";
    await upsertSetting(key, current ? "false" : "true");
  };

  const isOn = (key: string, defaultOn = true) =>
    defaultOn ? allSettings[key] !== "false" : allSettings[key] === "true";

  return (
    <div className="space-y-6">
      <ImpersonateUserCard profiles={profiles} />
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
            {NAV_LINKS.map(link => (
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
            <Select value={allSettings["it_default_theme"] || "light"} onValueChange={v => upsertSetting("it_default_theme", v)}>
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
