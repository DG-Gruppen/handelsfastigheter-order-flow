import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserCog, AlertTriangle, LogIn } from "lucide-react";

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
}

interface ImpersonateUserCardProps {
  profiles: Profile[];
}

const IMPERSONATION_KEY = "shf_impersonation_original_session";

export function isImpersonating(): boolean {
  return !!sessionStorage.getItem(IMPERSONATION_KEY);
}

export async function exitImpersonation() {
  const stored = sessionStorage.getItem(IMPERSONATION_KEY);
  if (!stored) return;

  try {
    const { access_token, refresh_token } = JSON.parse(stored);
    await supabase.auth.setSession({ access_token, refresh_token });
    sessionStorage.removeItem(IMPERSONATION_KEY);
    window.location.href = "/admin";
  } catch (err) {
    console.error("Failed to restore session:", err);
    sessionStorage.removeItem(IMPERSONATION_KEY);
    window.location.href = "/";
  }
}

export default function ImpersonateUserCard({ profiles }: ImpersonateUserCardProps) {
  const [targetUserId, setTargetUserId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleImpersonate = async () => {
    if (!targetUserId) {
      toast.error("Välj en användare att logga in som");
      return;
    }

    const target = profiles.find((p) => p.user_id === targetUserId);
    if (!target) return;

    setLoading(true);

    try {
      // Store current session before switching
      const { data: currentSession } = await supabase.auth.getSession();
      if (currentSession?.session) {
        sessionStorage.setItem(
          IMPERSONATION_KEY,
          JSON.stringify({
            access_token: currentSession.session.access_token,
            refresh_token: currentSession.session.refresh_token,
          })
        );
      }

      // Call edge function to get magic link token
      const { data, error } = await supabase.functions.invoke("impersonate-user", {
        body: { target_user_id: targetUserId },
      });

      if (error || !data?.token_hash) {
        throw new Error(error?.message || "Kunde inte generera session");
      }

      // Use the token hash to establish a session
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });

      if (verifyError) {
        throw verifyError;
      }

      toast.success(`Inloggad som ${target.full_name}`);
      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error("Impersonation failed:", err);
      toast.error("Kunde inte byta användare: " + (err.message || "Okänt fel"));
      // Restore original session if impersonation failed
      sessionStorage.removeItem(IMPERSONATION_KEY);
      setLoading(false);
    }
  };

  const sortedProfiles = [...profiles]
    .filter((p) => p.full_name)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "sv"));

  return (
    <Card className="glass-card border-t-2 border-t-warning/40">
      <CardHeader className="px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-warning/10 shadow-sm shadow-warning/10">
            <UserCog className="h-4 w-4 md:h-5 md:w-5 text-warning" />
          </div>
          <div>
            <CardTitle className="font-heading text-base md:text-lg text-warning">
              Logga in som användare
            </CardTitle>
            <CardDescription className="text-xs">
              Felsök genom att logga in som en annan användare
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 md:px-6 space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Du kommer att loggas in som den valda användaren med alla deras behörigheter. 
            En banner visas längst upp på sidan så att du kan återgå till ditt eget konto.
          </p>
        </div>

        <div className="flex gap-2">
          <Select value={targetUserId} onValueChange={setTargetUserId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Välj användare..." />
            </SelectTrigger>
            <SelectContent>
              {sortedProfiles.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  <span className="font-medium">{p.full_name}</span>
                  {p.department && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      ({p.department})
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleImpersonate}
            disabled={!targetUserId || loading}
            className="gap-2 gradient-primary hover:opacity-90 shadow-sm shadow-primary/20"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Byter..." : "Logga in"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
