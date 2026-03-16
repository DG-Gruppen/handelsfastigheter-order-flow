import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Monitor, ShieldCheck, Mail, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const Login = () => {
  const [remoteHelpSettings, setRemoteHelpSettings] = useState<Record<string, string>>({});
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [showEmail, setShowEmail] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/dashboard");
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("org_chart_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["it_remote_help_visible", "it_remote_help_label", "it_remote_help_url"]);
      const map: Record<string, string> = {};
      for (const s of (data as any[]) ?? []) map[s.setting_key] = s.setting_value;
      setRemoteHelpSettings(map);
    };
    fetchSettings();
  }, []);

  const handleGoogleSignIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/login",
      extraParams: {
        hd: "handelsfastigheter.se",
      },
    });
    if (result.error) console.error("Login error:", result.error);
  };

  const allowedDomains = ["dggruppen.se", "kazarian.se"];

  const isAllowedDomain = (email: string) => {
    const domain = email.split("@")[1]?.toLowerCase();
    return allowedDomains.includes(domain);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Fyll i e-post och lösenord");
      return;
    }
    if (!isAllowedDomain(email.trim())) {
      toast.error("Obehörig e-postadress");
      return;
    }
    setSubmitting(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Konto skapat! Kontrollera din e-post för att verifiera kontot.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error("Felaktig e-post eller lösenord");
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 gradient-bg" />
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/[0.06] blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary-glow/[0.04] blur-3xl" />

      <div className="w-full max-w-md space-y-8 relative z-10 animate-fade-up">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-xl shadow-primary/25">
            <Monitor className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            SHF Intra
          </h1>
        </div>

        <Card className="glass-card shadow-xl shadow-primary/[0.04] border-t-2 border-t-primary/40">
          <CardHeader className="text-center pb-2">
            <CardTitle className="font-heading text-xl">Logga in</CardTitle>
            <CardDescription>
              Använd ditt Google Workspace-konto eller e-post
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleGoogleSignIn}
              className="w-full h-12 text-base font-medium gap-3 gradient-primary hover:opacity-90 transition-opacity shadow-md shadow-primary/20"
              size="lg"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff" fillOpacity="0.8"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" fillOpacity="0.9"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" fillOpacity="0.7"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" fillOpacity="0.85"/>
              </svg>
              Logga in med Google
            </Button>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">eller</span>
              <Separator className="flex-1" />
            </div>

            {!showEmail ? (
              <Button
                variant="outline"
                className="w-full gap-2 glass-surface hover:bg-secondary/50 h-12"
                onClick={() => setShowEmail(true)}
              >
                <Mail className="h-4 w-4" />
                IT-Support login
              </Button>
            ) : (
              <form onSubmit={handleEmailAuth} className="space-y-4 animate-fade-up">
                <div className="space-y-2">
                  <Label htmlFor="email">E-post</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="namn@exempel.se"
                    autoComplete="email"
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Lösenord</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    minLength={6}
                    className="h-12"
                  />
                </div>
                <Button type="submit" className="w-full h-12 gradient-primary hover:opacity-90 shadow-md shadow-primary/20" disabled={submitting}>
                  {submitting ? "Vänta..." : "Logga in"}
                </Button>
              </form>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Säker inloggning</span>
              </div>
              {remoteHelpSettings["it_remote_help_visible"] !== "false" && (
                <a
                  href={remoteHelpSettings["it_remote_help_url"] || "https://my.splashtop.eu/sos/packages/download/37PXZW4LPWXTEU"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {remoteHelpSettings["it_remote_help_label"] || "Fjärrhjälp"}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
