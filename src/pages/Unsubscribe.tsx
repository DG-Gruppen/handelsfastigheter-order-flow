import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MailX, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid === false && data.reason === "already_unsubscribed") setStatus("already");
        else if (data.valid) setStatus("valid");
        else setStatus("invalid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (result.success) setStatus("success");
      else if (result.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === "success" || status === "already" ? (
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            ) : status === "invalid" || status === "error" ? (
              <AlertCircle className="h-12 w-12 text-destructive" />
            ) : (
              <MailX className="h-12 w-12 text-primary" />
            )}
          </div>
          <CardTitle>
            {status === "loading" && "Verifierar..."}
            {status === "valid" && "Avregistrera e-post"}
            {status === "already" && "Redan avregistrerad"}
            {status === "success" && "Avregistrerad!"}
            {status === "invalid" && "Ogiltig länk"}
            {status === "error" && "Något gick fel"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "loading" && (
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {status === "valid" && (
            <>
              <p className="text-muted-foreground text-sm">
                Klicka på knappen nedan för att sluta ta emot e-postmeddelanden från SHF Intra.
              </p>
              <Button onClick={handleUnsubscribe} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Bekräfta avregistrering
              </Button>
            </>
          )}
          {status === "already" && (
            <p className="text-muted-foreground text-sm">
              Du har redan avregistrerat dig från e-postmeddelanden.
            </p>
          )}
          {status === "success" && (
            <p className="text-muted-foreground text-sm">
              Du kommer inte längre att ta emot e-postmeddelanden från SHF Intra.
            </p>
          )}
          {status === "invalid" && (
            <p className="text-muted-foreground text-sm">
              Länken är ogiltig eller har redan använts. Kontrollera att du använder den senaste länken.
            </p>
          )}
          {status === "error" && (
            <p className="text-muted-foreground text-sm">
              Det gick inte att behandla din förfrågan. Försök igen senare.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
