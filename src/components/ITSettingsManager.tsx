import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link2, Palette, ExternalLink } from "lucide-react";

const NAV_LINKS = [
  { key: "nav_dashboard", label: "Dashboard", description: "Startsida med översikt" },
  { key: "nav_new_order", label: "Ny beställning", description: "Formulär för ny beställning" },
  { key: "nav_onboarding", label: "On-/Offboarding", description: "Formulär för nyanställning och avslut" },
  { key: "nav_approvals", label: "Att attestera", description: "Attesteringssida (chefer/admin)" },
  { key: "nav_history", label: "Historik", description: "Orderhistorik" },
  { key: "nav_org", label: "Organisation", description: "Organisationsträd (admin)" },
  { key: "nav_admin", label: "Admin", description: "Administrationspanel (admin)" },
];

// All IT setting keys to fetch
const IT_SETTING_KEYS_PREFIX = ["nav_", "it_"];

export default function ITSettingsManager() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("org_chart_settings")
        .select("setting_key, setting_value");
      const map: Record<string, string> = {};
      for (const s of (data as any[]) ?? []) map[s.setting_key] = s.setting_value;
      setSettings(map);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const upsertSetting = async (key: string, value: string) => {
    await supabase
      .from("org_chart_settings")
      .upsert(
        { setting_key: key, setting_value: value, updated_at: new Date().toISOString() } as any,
        { onConflict: "setting_key" }
      );
    setSettings((prev) => ({ ...prev, [key]: value }));
    toast.success("Inställning uppdaterad");
  };

  const toggleSetting = async (key: string, defaultOn = true) => {
    const current = defaultOn ? settings[key] !== "false" : settings[key] === "true";
    await upsertSetting(key, current ? "false" : "true");
  };

  const isOn = (key: string, defaultOn = true) =>
    defaultOn ? settings[key] !== "false" : settings[key] === "true";

  return (
    <div className="space-y-6">
      {/* Navigation links – Himmel och Vatten (primary) */}
      <Card className="glass-card border-t-2 border-t-primary/40">
        <CardHeader className="px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shadow-sm shadow-primary/10">
              <Link2 className="h-5 w-5 text-primary" />
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
              <div
                key={link.key}
                className="flex items-center justify-between rounded-xl border border-primary/10 bg-primary/[0.03] p-3 hover:bg-primary/[0.06] transition-colors"
              >
                <div className="min-w-0 mr-2">
                  <p className="text-sm font-medium text-foreground">{link.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{link.description}</p>
                </div>
                <Switch
                  checked={isOn(link.key)}
                  onCheckedChange={() => toggleSetting(link.key)}
                  disabled={loading}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Default theme – Land och Miljö (accent/success) */}
      <Card className="glass-card border-t-2 border-t-accent/40">
        <CardHeader className="px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 shadow-sm shadow-accent/10">
              <Palette className="h-5 w-5 text-accent" />
            </div>
            <div>
              <CardTitle className="font-heading text-base md:text-lg text-accent">Utseende</CardTitle>
              <CardDescription className="text-xs">Standardtema för nya användare</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <div className="flex items-center justify-between rounded-xl border border-accent/10 bg-accent/[0.03] p-4 hover:bg-accent/[0.06] transition-colors">
            <div>
              <p className="text-sm font-medium text-foreground">Tema för nya användare</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nuvarande: {(settings["it_default_theme"] || "light") === "light" ? "Ljust" : "Mörkt"}
              </p>
            </div>
            <Select
              value={settings["it_default_theme"] || "light"}
              onValueChange={(v) => upsertSetting("it_default_theme", v)}
              disabled={loading}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Ljust</SelectItem>
                <SelectItem value="dark">Mörkt</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Remote help link – Eld och Värme (warning/destructive) */}
      <Card className="glass-card border-t-2 border-t-warning/40">
        <CardHeader className="px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 shadow-sm shadow-warning/10">
              <ExternalLink className="h-5 w-5 text-warning" />
            </div>
            <div>
              <CardTitle className="font-heading text-base md:text-lg text-warning">Fjärrhjälp</CardTitle>
              <CardDescription className="text-xs">Supportlänk i användarmenyn och på inloggningssidan</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-warning/10 bg-warning/[0.03] p-4 hover:bg-warning/[0.06] transition-colors">
            <div>
              <p className="text-sm font-medium text-foreground">Visa fjärrhjälpslänk</p>
              <p className="text-xs text-muted-foreground mt-0.5">Visar länken i menyn och på login</p>
            </div>
            <Switch
              checked={isOn("it_remote_help_visible")}
              onCheckedChange={() => toggleSetting("it_remote_help_visible")}
              disabled={loading}
            />
          </div>
          <div className="rounded-xl border border-warning/10 bg-warning/[0.03] p-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Länktext</label>
              <input
                type="text"
                placeholder="Fjärrhjälp (Splashtop)"
                value={settings["it_remote_help_label"] ?? "Fjärrhjälp (Splashtop)"}
                onChange={(e) => setSettings((prev) => ({ ...prev, it_remote_help_label: e.target.value }))}
                onBlur={(e) => upsertSetting("it_remote_help_label", e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-warning/30"
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">URL</label>
              <input
                type="url"
                placeholder="https://..."
                value={settings["it_remote_help_url"] ?? "https://my.splashtop.eu/sos/packages/download/37PXZW4LPWXTEU"}
                onChange={(e) => setSettings((prev) => ({ ...prev, it_remote_help_url: e.target.value }))}
                onBlur={(e) => upsertSetting("it_remote_help_url", e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-warning/30"
                disabled={loading}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
