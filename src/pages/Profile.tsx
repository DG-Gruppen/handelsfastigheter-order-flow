import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Moon } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Chef",
  employee: "Anställd",
  staff: "Stab",
  it: "IT",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive",
  manager: "bg-amber-500/10 text-amber-600",
  employee: "bg-emerald-500/10 text-emerald-600",
  staff: "bg-purple-500/10 text-purple-600",
  it: "bg-blue-500/10 text-blue-600",
};

export default function Profile() {
  const { profile, roles } = useAuth();
  const { theme, setTheme } = useTheme();

  const [phone, setPhone] = useState(profile?.phone || "");
  const [saving, setSaving] = useState(false);

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const isDark = theme === "dark";

  const handleToggleTheme = useCallback(async () => {
    const newTheme = isDark ? "light" : "dark";
    setTheme(newTheme);
    if (profile?.user_id) {
      await supabase.from("profiles").update({ theme_preference: newTheme }).eq("user_id", profile.user_id);
    }
  }, [isDark, setTheme, profile?.user_id]);

  const handleSave = async () => {
    if (!profile?.user_id) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ phone })
      .eq("user_id", profile.user_id);
    setSaving(false);
    if (error) {
      toast.error("Kunde inte spara");
    } else {
      toast.success("Profil uppdaterad");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">Min profil</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile info card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personuppgifter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold text-foreground">{profile?.full_name || "Användare"}</div>
                <div className="text-sm text-muted-foreground">{profile?.email}</div>
                {roles.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {roles.map((r) => (
                      <span
                        key={r}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[r] || "bg-muted text-muted-foreground"}`}
                      >
                        {ROLE_LABELS[r] || r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">Telefonnummer</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="070-123 45 67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 md:h-10"
              />
            </div>

            {/* Department (read-only) */}
            {profile?.department && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Avdelning</Label>
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2.5">
                  {profile.department}
                </div>
              </div>
            )}

            <Button onClick={handleSave} disabled={saving} className="w-full gap-2 h-12 md:h-10">
              <Save className="w-4 h-4" />
              {saving ? "Sparar..." : "Spara ändringar"}
            </Button>
          </CardContent>
        </Card>

        {/* Settings card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inställningar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Theme toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                  <Moon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm font-medium">Mörkt tema</div>
                  <div className="text-xs text-muted-foreground">Växla mellan ljust och mörkt utseende</div>
                </div>
              </div>
              <Switch checked={isDark} onCheckedChange={handleToggleTheme} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
