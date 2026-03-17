import { useState, useEffect } from "react";
import { X, Globe, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type BrowserType = "chrome" | "firefox" | "safari" | "edge" | "opera" | "other";

function detectBrowser(): BrowserType {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("edg/") || ua.includes("edga/") || ua.includes("edgios/")) return "edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "opera";
  if (ua.includes("firefox") || ua.includes("fxios")) return "firefox";
  if (ua.includes("safari") && !ua.includes("chrome") && !ua.includes("crios")) return "safari";
  if (ua.includes("chrome") || ua.includes("crios")) return "chrome";
  return "other";
}

const BROWSER_LABELS: Record<BrowserType, string> = {
  chrome: "Google Chrome",
  firefox: "Mozilla Firefox",
  safari: "Safari",
  edge: "Microsoft Edge",
  opera: "Opera",
  other: "din webbläsare",
};

const BROWSER_STEPS: Record<BrowserType, string[]> = {
  chrome: [
    "Klicka på de tre prickarna (⋮) uppe till höger",
    "Välj \"Inställningar\"",
    "Under \"Vid start\" välj \"Öppna en specifik sida eller uppsättning sidor\"",
    "Klicka \"Lägg till en ny sida\" och klistra in denna URL",
  ],
  firefox: [
    "Klicka på hamburgermenyn (☰) uppe till höger",
    "Välj \"Inställningar\"",
    "Under \"Startsida\" ändra \"Startsida och nya fönster\" till \"Anpassade webbadresser\"",
    "Klistra in denna URL i fältet",
  ],
  safari: [
    "Klicka på \"Safari\" i menyraden",
    "Välj \"Inställningar\" (eller tryck ⌘ + ,)",
    "Under fliken \"Allmänt\", ange denna URL i fältet \"Startsida\"",
  ],
  edge: [
    "Klicka på de tre prickarna (⋯) uppe till höger",
    "Välj \"Inställningar\"",
    "Klicka på \"Start, startsida och nya flikar\" i sidomenyn",
    "Under \"När Edge startar\" välj \"Öppna de här sidorna\" och lägg till denna URL",
  ],
  opera: [
    "Klicka på Opera-logotypen uppe till vänster",
    "Välj \"Inställningar\"",
    "Under \"Vid start\" välj \"Öppna en specifik sida eller uppsättning sidor\"",
    "Klicka \"Lägg till en ny sida\" och klistra in denna URL",
  ],
  other: [
    "Öppna webbläsarens inställningar",
    "Leta efter \"Startsida\" eller \"Vid start\"",
    "Ange denna URL som din startsida",
  ],
};

const STORAGE_KEY = "shf-homepage-dismissed";

export default function HomepageSuggestion() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [browser] = useState<BrowserType>(detectBrowser);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      // Show after short delay so it doesn't compete with page load
      const t = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="mx-4 mb-4 rounded-xl border bg-card text-card-foreground shadow-lg overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start gap-3 p-4 pb-2">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">
                Gör SHF till din startsida
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Få snabb åtkomst varje gång du öppnar {BROWSER_LABELS[browser]}
              </p>
            </div>
            <button
              onClick={dismiss}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Expand / collapse */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 px-4 pb-3 text-xs font-medium text-primary hover:underline"
          >
            {expanded ? "Dölj instruktioner" : "Visa hur"}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                      {BROWSER_LABELS[browser]}
                    </p>
                    <ol className="space-y-1.5">
                      {BROWSER_STEPS[browser].map((step, i) => (
                        <li key={i} className="flex gap-2 text-xs text-foreground/80">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                            {i + 1}
                          </span>
                          <span className="pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Copy URL */}
                  <button
                    onClick={copyUrl}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                      copied
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-muted/30 border-border hover:bg-muted text-foreground"
                    )}
                  >
                    {copied ? "✓ Kopierad!" : `Kopiera URL: ${window.location.origin}`}
                  </button>

                  <button
                    onClick={dismiss}
                    className="w-full text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
                  >
                    Påminn mig inte igen
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
