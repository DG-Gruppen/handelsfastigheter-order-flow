import { useState } from "react";
import { Bell, BellOff, Smartphone, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export default function PushNotificationSettings() {
  const { state, busy, enable, disable, sendTest, isIos } = usePushNotifications();
  const [testing, setTesting] = useState(false);

  const isOn = state === "on";

  const handleToggle = async () => {
    if (isOn) {
      await disable();
      toast.success("Push-notiser avstängda på den här enheten");
      return;
    }
    const res = await enable();
    if (res.ok) {
      toast.success("Push-notiser påslagna på den här enheten");
    } else if (res.reason === "denied") {
      toast.error("Du behöver tillåta notiser i telefonens inställningar för SHF Intra");
    } else if (res.reason === "iframe") {
      toast.error("Öppna SHF Intra i eget fönster för att slå på notiser");
    } else {
      toast.error("Kunde inte slå på notiser på den här enheten");
    }
  };

  const handleTest = async () => {
    setTesting(true);
    const ok = await sendTest();
    setTesting(false);
    ok ? toast.success("Testnotis skickad") : toast.error("Kunde inte skicka testnotis");
  };

  return (
    <Card className="glass-card">
      <CardContent className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Notiser i mobilen
        </h2>

        {state === "needs-install" && (
          <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-secondary/20 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Smartphone className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              {isIos
                ? "Lägg först till SHF Intra på hemskärmen via Dela-knappen i Safari. Öppna sedan appen därifrån så kan du slå på notiser här."
                : "Lägg till SHF Intra på hemskärmen och öppna appen därifrån för att slå på notiser."}
            </p>
          </div>
        )}

        {state === "unsupported" && (
          <p className="text-sm text-muted-foreground">
            Den här webbläsaren stödjer inte notiser. Prova Safari på iPhone eller Chrome på Android.
          </p>
        )}

        {state === "denied" && (
          <p className="text-sm text-muted-foreground">
            Notiser är blockerade för SHF Intra. Tillåt notiser i telefonens inställningar och ladda om sidan.
          </p>
        )}

        {(state === "on" || state === "off" || state === "loading") && (
          <>
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/20 p-3 min-h-[56px]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                {isOn ? (
                  <Bell className="h-4 w-4 text-primary" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Push-notiser på den här enheten</p>
                <p className="text-xs text-muted-foreground">
                  Få notiser direkt i telefonen, även när appen är stängd
                </p>
              </div>
              <Switch
                checked={isOn}
                disabled={busy || state === "loading"}
                onCheckedChange={handleToggle}
              />
            </div>

            {isOn && (
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                <Send className="h-4 w-4 mr-2" />
                {testing ? "Skickar..." : "Skicka testnotis"}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
