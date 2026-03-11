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
    <Card className="glass-card animate-fade-up">
      <CardHeader className="px-4 md:px-6">
        <CardTitle className="font-heading text-base md:text-lg">IT-inställningar</CardTitle>
        <CardDescription className="text-sm">Inställningar som hanteras av IT-avdelningen</CardDescription>
      </CardHeader>
      <CardContent className="px-4 md:px-6 space-y-8">
        {/* Navigation links */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Synliga navigationslänkar</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Styr vilka länkar som visas i headern. Avstängda sidor blockeras även via direktlänk.
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
                  checked={isOn(link.key)}
                  onCheckedChange={() => toggleSetting(link.key)}
                  disabled={loading}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Default theme */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Standardtema</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Vilket tema nya användare får som standard vid första inloggningen.
          </p>
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/20 p-4">
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
        </div>

        {/* Remote help link */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Fjärrhjälpslänk</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Länk som visas i användarmenyn för fjärrsupport. Lämna URL tom för att dölja.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/20 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Visa fjärrhjälpslänk</p>
                <p className="text-xs text-muted-foreground mt-0.5">Visar länken i användarmenyn</p>
              </div>
              <Switch
                checked={isOn("it_remote_help_visible")}
                onCheckedChange={() => toggleSetting("it_remote_help_visible")}
                disabled={loading}
              />
            </div>
            <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Länktext</label>
                <input
                  type="text"
                  placeholder="Fjärrhjälp (Splashtop)"
                  value={settings["it_remote_help_label"] ?? "Fjärrhjälp (Splashtop)"}
                  onChange={(e) => setSettings((prev) => ({ ...prev, it_remote_help_label: e.target.value }))}
                  onBlur={(e) => upsertSetting("it_remote_help_label", e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                  className="w-full h-10 px-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
