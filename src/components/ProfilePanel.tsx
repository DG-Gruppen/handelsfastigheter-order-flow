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
import { LogOut, Save, Moon } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePanel({ onClose }: { onClose?: () => void }) {
  const { profile, roles, signOut } = useAuth();
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
      onClose?.();
    }
  };

  const ROLE_LABELS: Record<string, string> = {
    admin: "Admin",
    manager: "Chef",
    employee: "Anställd",
    staff: "Stab",
    it: "IT",
  };

  return (
    <div className="space-y-5">
      {/* Profile header */}
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground truncate">{profile?.full_name || "Användare"}</div>
          <div className="text-xs text-muted-foreground truncate">{profile?.email}</div>
          {roles.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {roles.map((r) => (
                <span key={r} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                  {ROLE_LABELS[r] || r}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Phone number */}
      <div className="space-y-2">
        <Label htmlFor="phone" className="text-xs font-medium">Telefonnummer</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="070-123 45 67"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-9"
        />
      </div>

      {/* Department (read-only) */}
      {profile?.department && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Avdelning</Label>
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">{profile.department}</div>
        </div>
      )}

      <Separator />

      {/* Theme toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Mörkt tema</span>
        </div>
        <Switch checked={isDark} onCheckedChange={handleToggleTheme} />
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} size="sm" className="flex-1 gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Sparar..." : "Spara"}
        </Button>
        <Button onClick={signOut} variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
          <LogOut className="w-4 h-4" />
          Logga ut
        </Button>
      </div>
    </div>
  );
}
