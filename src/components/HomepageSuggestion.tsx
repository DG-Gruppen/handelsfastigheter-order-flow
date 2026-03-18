import { useState, useEffect, useRef } from "react";
import { X, Globe, ChevronDown, ChevronUp, Smartphone, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isSamsungBrowser() {
  return /samsungbrowser/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
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

const IOS_PWA_STEPS = [
  "Öppna SHF i Safari (det fungerar inte i Chrome eller andra webbläsare på iPhone)",
  "Tryck på Dela-ikonen ⬆ (fyrkant med pil uppåt) längst ner i Safari",
  "Scrolla ner i menyn och tryck på \"Lägg till på hemskärmen\" 📲",
  "Skriv \"SHF\" som namn och tryck \"Lägg till\" uppe till höger",
  "Appen finns nu som en ikon på din hemskärm — öppna den därifrån för bästa upplevelse!",
];

const ANDROID_CHROME_PWA_STEPS = [
  "Öppna SHF i Google Chrome",
  "Tryck på de tre prickarna ⋮ uppe till höger",
  "Välj \"Installera app\" eller \"Lägg till på startskärmen\"",
  "Tryck \"Installera\" i dialogrutan som visas",
  "Appen finns nu i din applista och på hemskärmen — tryck på ikonen för att öppna!",
];

const ANDROID_SAMSUNG_PWA_STEPS = [
  "Öppna SHF i Samsung Internet",
  "Tryck på hamburgermenyn ☰ (tre streck) längst ner",
  "Välj \"Lägg till sida på\" → \"Startskärm\"",
  "Namnge genvägen \"SHF\" och tryck \"Lägg till\"",
  "Appen finns nu som en ikon på din hemskärm!",
];

const STORAGE_KEY = "shf-homepage-dismissed";

export default function HomepageSuggestion() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [browser] = useState<BrowserType>(detectBrowser);
  const [copied, setCopied] = useState(false);
  const isMobile = useIsMobile();
  const deferredPromptRef = useRef<any>(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [showPwaTab, setShowPwaTab] = useState(false);

  // Listen for the beforeinstallprompt event (Chrome/Edge/Android)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setCanInstallPwa(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (isInStandaloneMode()) return;

    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      const t = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  // Auto-dismiss after 30 seconds of no interaction
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setVisible(false);
    }, 30000);
    return () => clearTimeout(t);
  }, [visible, expanded]);

  // Default to PWA tab on mobile
  useEffect(() => {
    if (isMobile) setShowPwaTab(true);
  }, [isMobile]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInstallPwa = async () => {
    if (deferredPromptRef.current) {
      deferredPromptRef.current.prompt();
      const { outcome } = await deferredPromptRef.current.userChoice;
      if (outcome === "accepted") {
        dismiss();
      }
      deferredPromptRef.current = null;
      setCanInstallPwa(false);
    }
  };

  const pwaSteps = isIos()
    ? IOS_PWA_STEPS
    : isSamsungBrowser()
      ? ANDROID_SAMSUNG_PWA_STEPS
      : ANDROID_CHROME_PWA_STEPS;

  const pwaLabel = isIos()
    ? "iPhone / iPad (Safari)"
    : isSamsungBrowser()
      ? "Android (Samsung Internet)"
      : "Android (Chrome)";

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
              {isMobile ? (
                <Smartphone className="h-5 w-5 text-primary" />
              ) : (
                <Globe className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">
                {isMobile ? "Installera SHF som app" : "Gör SHF till din startsida"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isMobile
                  ? "Lägg till SHF på din hemskärm för snabb åtkomst"
                  : `Få snabb åtkomst varje gång du öppnar ${BROWSER_LABELS[browser]}`}
              </p>
            </div>
            <button
              onClick={dismiss}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Native install button (Chrome/Edge on Android) */}
          {canInstallPwa && isMobile && (
            <div className="px-4 pb-2">
              <button
                onClick={handleInstallPwa}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium transition-colors hover:bg-primary/90"
              >
                <Download className="h-4 w-4" />
                Installera SHF
              </button>
            </div>
          )}

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
                  {/* Tab switcher (only if not purely mobile-only) */}
                  <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
                    <button
                      onClick={() => setShowPwaTab(true)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        showPwaTab
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Smartphone className="h-3 w-3" />
                      Hemskärm
                    </button>
                    <button
                      onClick={() => setShowPwaTab(false)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        !showPwaTab
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Globe className="h-3 w-3" />
                      Startsida
                    </button>
                  </div>

                  {/* Instructions */}
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                      {showPwaTab
                        ? pwaLabel
                        : BROWSER_LABELS[browser]}
                    </p>
                    <ol className="space-y-1.5">
                      {(showPwaTab ? pwaSteps : BROWSER_STEPS[browser]).map((step, i) => (
                        <li key={i} className="flex gap-2 text-xs text-foreground/80">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                            {i + 1}
                          </span>
                          <span className="pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Copy URL (only for startsida tab) */}
                  {!showPwaTab && (
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
                  )}

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
