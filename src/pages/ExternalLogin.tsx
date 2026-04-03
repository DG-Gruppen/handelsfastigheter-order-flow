import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Building2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function ExternalLogin() {
  const { user, loading, profile } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Fyll i e-post och lösenord");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      toast.error("Felaktig e-post eller lösenord");
    }
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 gradient-bg" />
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent/[0.06] blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/[0.04] blur-3xl" />

      <div className="w-full max-w-md space-y-8 relative z-10 animate-fade-up">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent/80 shadow-xl shadow-accent/25">
            <Building2 className="h-8 w-8 text-accent-foreground" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            SHF Extern
          </h1>
          <p className="text-sm text-muted-foreground">Portal för externa samarbetspartners</p>
        </div>

        <Card className="glass-card shadow-xl border-t-2 border-t-accent/40">
          <CardHeader className="text-center pb-2">
            <CardTitle className="font-heading text-xl">Logga in</CardTitle>
            <CardDescription>
              Använd dina inloggningsuppgifter från inbjudan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ext-email">E-post</Label>
                <Input
                  id="ext-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="namn@foretag.se"
                  autoComplete="email"
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ext-password">Lösenord</Label>
                <Input
                  id="ext-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  minLength={6}
                  className="h-12"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-accent to-accent/80 hover:opacity-90 shadow-md shadow-accent/20"
                disabled={submitting}
              >
                {submitting ? "Vänta..." : "Logga in"}
              </Button>
            </form>

            <div className="flex items-center justify-center text-xs text-muted-foreground pt-4 gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Säker inloggning – Svenska Handelsfastigheter</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
