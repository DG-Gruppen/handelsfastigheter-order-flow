import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const DISMISS_KEY = "shf-push-prompt-dismissed";

/** Uppmanar alla inloggade användare att slå på push-notiser på sin enhet.
    Webbläsaren kräver att varje användare själv godkänner notiser. */
export default function PushEnablePrompt() {
  const { state, busy, enable } = usePushNotifications();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const inIframe = typeof window !== "undefined" && window.top !== window.self;
  if (dismissed || inIframe || state !== "off") return null;

  const handleEnable = async () => {
    const res = await enable();
    if (res.ok) {
      toast.success("Notiser påslagna på den här enheten");
    } else if (res.reason === "denied") {
      toast.error("Tillåt notiser för SHF Intra i enhetens inställningar");
      localStorage.setItem(DISMISS_KEY, "1");
      setDismissed(true);
    } else {
      toast.error("Kunde inte slå på notiser på den här enheten");
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-border/60 bg-card/95 p-4 shadow-lg backdrop-blur md:left-auto md:right-6 md:bottom-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Bell className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Slå på notiser</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Få beställningar, uppgifter och meddelanden direkt i mobilen.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleEnable} disabled={busy}>
              {busy ? "Slår på..." : "Slå på"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Inte nu
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Stäng"
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
