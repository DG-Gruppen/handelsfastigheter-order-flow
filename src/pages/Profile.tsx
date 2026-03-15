import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Save, Moon, Phone, Building2, Mail, Shield } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Chef",
  employee: "Anställd",
  staff: "Stab",
  it: "IT",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  manager: "bg-warning/10 text-warning border-warning/20",
  employee: "bg-accent/10 text-accent border-accent/20",
  staff: "bg-primary/10 text-primary border-primary/20",
  it: "bg-primary/10 text-primary border-primary/20",
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
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-up min-w-0">
      {/* Profile header */}
      <div className="flex flex-col items-center text-center pt-2 pb-4 min-w-0">
        <Avatar className="h-20 w-20 ring-4 ring-primary/10 shadow-lg shadow-primary/10">
          <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground mt-4">
          {profile?.full_name || "Användare"}
        </h1>
        {profile?.email && (
          <p className="text-sm text-muted-foreground mt-0.5 break-all">{profile.email}</p>
        )}
        {roles.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap justify-center">
            {roles.map((r) => (
              <span
                key={r}
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border ${ROLE_COLORS[r] || "bg-muted text-muted-foreground border-border"}`}
              >
                <Shield className="h-3 w-3" />
                {ROLE_LABELS[r] || r}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Info cards - stacked on mobile */}
      <div className="space-y-4 min-w-0">
        {/* Contact info */}
        <Card className="glass-card">
          <CardContent className="p-4 md:p-6 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Kontaktuppgifter</h2>

            {/* Email (read-only) */}
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/20 p-3 min-h-[56px] min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">E-post</p>
                <p className="text-sm font-medium text-foreground truncate">{profile?.email}</p>
              </div>
            </div>

            {/* Department (read-only) */}
            {profile?.department && (
              <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/20 p-3 min-h-[56px] min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Avdelning</p>
                  <p className="text-sm font-medium text-foreground truncate">{profile.department}</p>
                </div>
              </div>
            )}

            {/* Phone (editable) */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Telefonnummer
              </Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                placeholder="070-123 45 67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 md:h-10"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full gap-2 h-12 md:h-10 gradient-primary hover:opacity-90 shadow-md shadow-primary/20"
            >
              <Save className="w-4 h-4" />
              {saving ? "Sparar..." : "Spara ändringar"}
            </Button>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card className="glass-card">
          <CardContent className="p-4 md:p-6 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Inställningar</h2>

            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/20 p-3 min-h-[56px] min-w-0 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Moon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Mörkt tema</p>
                  <p className="text-xs text-muted-foreground">Ljust / mörkt utseende</p>
                </div>
              </div>
              <Switch checked={isDark} onCheckedChange={handleToggleTheme} className="shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
