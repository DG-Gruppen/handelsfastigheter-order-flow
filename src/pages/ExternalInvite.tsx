import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface InviteData {
  email: string;
  company_name: string;
  expires_at: string;
  accepted_at: string | null;
}

export default function ExternalInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Standardiserat felmeddelande för alla token-relaterade fel (saknad,
  // ogiltig, för kort, utgången, redan accepterad). Vi avslöjar avsiktligt
  // inte vilken delfel som inträffade — det förhindrar enumerering och ger
  // en enhetlig användarupplevelse.
  const INVITE_UNAVAILABLE_MSG =
    "Inbjudningslänken är ogiltig eller kan inte längre användas. Kontakta din kontaktperson för en ny.";

  useEffect(() => {
    async function loadInvite() {
      if (!token || token.length < 32) {
        setError(INVITE_UNAVAILABLE_MSG);
        setLoadingInvite(false);
        return;
      }

      const { data: rows, error: fetchErr } = await supabase
        .rpc("get_external_invite_by_token", { _token: token });
      const data = Array.isArray(rows) ? rows[0] : null;

      const isUnavailable =
        fetchErr ||
        !data ||
        !!data.accepted_at ||
        new Date(data.expires_at) < new Date();

      if (isUnavailable) {
        setError(INVITE_UNAVAILABLE_MSG);
      } else {
        setInvite(data as InviteData);
      }
      setLoadingInvite(false);
    }
    loadInvite();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Lösenorden matchar inte");
      return;
    }
    if (password.length < 6) {
      toast.error("Lösenordet måste vara minst 6 tecken");
      return;
    }
    if (fullName.trim().length < 2) {
      toast.error("Ange ditt namn");
      return;
    }

    setSubmitting(true);
    try {
      const res = await supabase.functions.invoke("accept-external-invite", {
        body: { token, password, full_name: fullName.trim() },
      });

      if (res.error) {
        const msg = res.error.message || "Ett fel uppstod";
        toast.error(msg);
        setSubmitting(false);
        return;
      }

      const data = res.data;
      if (data?.error) {
        toast.error(data.error);
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      toast.success("Konto skapat! Du kan nu logga in.");
    } catch (err) {
      toast.error("Ett oväntat fel uppstod");
    }
    setSubmitting(false);
  };

  if (loadingInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 gradient-bg" />
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent/[0.06] blur-3xl" />

      <div className="w-full max-w-md space-y-8 relative z-10 animate-fade-up">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent/80 shadow-xl shadow-accent/25">
            <Building2 className="h-8 w-8 text-accent-foreground" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            SHF Extern
          </h1>
        </div>

        <Card className="glass-card shadow-xl border-t-2 border-t-accent/40">
          {error ? (
            <CardContent className="py-10 text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </CardContent>
          ) : success ? (
            <CardContent className="py-10 text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-success" />
              <div>
                <p className="font-heading font-semibold text-foreground">Konto skapat!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Du kan nu logga in med din e-post och lösenord.
                </p>
              </div>
              <Button
                onClick={() => navigate("/extern")}
                className="bg-gradient-to-r from-accent to-accent/80 hover:opacity-90"
              >
                Gå till inloggning
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader className="text-center pb-2">
                <CardTitle className="font-heading text-xl">Skapa ditt konto</CardTitle>
                <CardDescription>
                  {invite?.company_name
                    ? `Du har bjudits in som extern partner från ${invite.company_name}`
                    : "Du har bjudits in som extern partner"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>E-post</Label>
                    <Input
                      value={invite?.email || ""}
                      disabled
                      className="h-12 bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-name">Ditt namn</Label>
                    <Input
                      id="inv-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Förnamn Efternamn"
                      className="h-12"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-pwd">Välj lösenord</Label>
                    <Input
                      id="inv-pwd"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minst 6 tecken"
                      minLength={6}
                      className="h-12"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-pwd2">Bekräfta lösenord</Label>
                    <Input
                      id="inv-pwd2"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Upprepa lösenordet"
                      minLength={6}
                      className="h-12"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-accent to-accent/80 hover:opacity-90 shadow-md shadow-accent/20"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />Skapar konto...</>
                    ) : (
                      "Skapa konto"
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
