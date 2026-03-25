import { useState, useEffect, useRef } from "react";
import { Smartphone, Monitor, Download, Apple, Chrome } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Platform = "ios" | "android-chrome" | "android-samsung" | "desktop";

const APP_URL = "intra.handelsfastigheter.se";

const IOS_STEPS = [
  { icon: "🌐", text: `Öppna ${APP_URL} i Safari — det fungerar inte i Chrome eller andra webbläsare på iPhone/iPad` },
  { icon: "⬆️", text: "Tryck på Dela-ikonen (fyrkant med pil uppåt) längst ner i Safari" },
  { icon: "📲", text: "Scrolla ner i menyn och tryck på \"Lägg till på hemskärmen\"" },
  { icon: "✏️", text: "Skriv \"SHF\" som namn och tryck \"Lägg till\" uppe till höger" },
  { icon: "✅", text: "Klart! SHF finns nu som en app-ikon på din hemskärm" },
];

const ANDROID_CHROME_STEPS = [
  { icon: "🌐", text: `Öppna ${APP_URL} i Google Chrome` },
  { icon: "⋮", text: "Tryck på de tre prickarna (⋮) uppe till höger i Chrome" },
  { icon: "📲", text: "Välj \"Installera app\" eller \"Lägg till på startskärmen\"" },
  { icon: "✅", text: "Tryck \"Installera\" i dialogrutan — appen finns nu i din applista!" },
];

const ANDROID_SAMSUNG_STEPS = [
  { icon: "🌐", text: `Öppna ${APP_URL} i Samsung Internet` },
  { icon: "☰", text: "Tryck på hamburgermenyn (tre streck ☰) längst ner" },
  { icon: "📲", text: "Välj \"Lägg till sida på\" → \"Startskärm\"" },
  { icon: "✏️", text: "Namnge genvägen \"SHF\" och tryck \"Lägg till\"" },
  { icon: "✅", text: "Klart! SHF finns nu som en ikon på din hemskärm" },
];

const DESKTOP_STEPS = [
  { icon: "🌐", text: `Öppna ${APP_URL} i Chrome eller Edge på din dator` },
  { icon: "📥", text: "Klicka på installationsikonen i adressfältet (liten datorskärm med nedåtpil)" },
  { icon: "✅", text: "Klicka \"Installera\" — appen öppnas som ett eget fönster och kan startas från aktivitetsfältet" },
];

const PLATFORMS: { id: Platform; label: string; icon: React.ReactNode }[] = [
  { id: "ios", label: "iPhone / iPad", icon: <Apple className="h-3.5 w-3.5" /> },
  { id: "android-chrome", label: "Android (Chrome)", icon: <Chrome className="h-3.5 w-3.5" /> },
  { id: "android-samsung", label: "Android (Samsung)", icon: <Smartphone className="h-3.5 w-3.5" /> },
  { id: "desktop", label: "Dator", icon: <Monitor className="h-3.5 w-3.5" /> },
];

function getSteps(platform: Platform) {
  switch (platform) {
    case "ios": return IOS_STEPS;
    case "android-chrome": return ANDROID_CHROME_STEPS;
    case "android-samsung": return ANDROID_SAMSUNG_STEPS;
    case "desktop": return DESKTOP_STEPS;
  }
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/samsungbrowser/.test(ua)) return "android-samsung";
  if (/android/.test(ua)) return "android-chrome";
  return "desktop";
}

export default function PwaInstallGuide() {
  const [platform, setPlatform] = useState<Platform>(detectPlatform);
  const deferredPromptRef = useRef<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPromptRef.current) return;
    deferredPromptRef.current.prompt();
    await deferredPromptRef.current.userChoice;
    deferredPromptRef.current = null;
    setCanInstall(false);
  };

  const steps = getSteps(platform);

  return (
    <Card className="glass-card border-t-2 border-t-primary/40">
      <CardHeader className="px-4 md:px-6 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shadow-sm shadow-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="font-heading text-base md:text-lg text-primary">Installera SHF-appen</CardTitle>
            <CardDescription className="text-xs">Lägg till SHF på din hemskärm för snabb åtkomst — ingen appbutik behövs</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 md:px-6 space-y-4">
        {/* Platform selector */}
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                platform === p.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>

        {/* Native install button */}
        {canInstall && (
          <button
            onClick={handleInstall}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium transition-colors hover:bg-primary/90"
          >
            <Download className="h-4 w-4" />
            Installera SHF direkt
          </button>
        )}

        {/* Steps */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-2.5">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">
            Steg-för-steg
          </p>
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-foreground/85">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <span className="pt-0.5 leading-snug">{step.text}</span>
              </li>
            ))}
          </ol>
        </div>

        {platform === "ios" && (
          <p className="text-xs text-muted-foreground italic">
            💡 Tips: På iOS måste du använda Safari — Apple tillåter inte att andra webbläsare installerar appar på hemskärmen.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
