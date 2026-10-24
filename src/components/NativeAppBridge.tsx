import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { SplashScreen } from "@capacitor/splash-screen";
import { SystemBars, SystemBarsStyle } from "@capacitor/core";
import { FirebaseMessaging, Importance } from "@capacitor-firebase/messaging";
import { completeNativeGoogleSignIn } from "@/lib/native/googleSignIn";
import { nativePlatform } from "@/lib/native/platform";
import { getAppBaseUrl } from "@/lib/utils";

const NOTIFICATION_CHANNEL_ID = "shf_default"; // samma som default_notification_channel_id i Android-manifestet

// Vid kallstart kan samma länk komma både via getLaunchUrl och appUrlOpen.
const handledUrls = new Set<string>();

/** Gör om en länk från en notis till en intern sökväg, eller null om den pekar utanför appen. */
function toAppPath(link: unknown): string | null {
  if (typeof link !== "string" || !link) return null;
  if (link.startsWith("/")) return link;
  try {
    const url = new URL(link);
    return url.origin === getAppBaseUrl() ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

/** Stänger öppen dialog/meny i stället för att lämna sidan när Androids bakåtknapp trycks. */
function closeOpenOverlay(): boolean {
  if (!document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]')) return false;
  (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }),
  );
  return true;
}

/** Kopplar ihop webbappen med Android/iOS-appen. Renderas bara i appen. */
export default function NativeAppBridge() {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    void SystemBars.setStyle({ style: resolvedTheme === "dark" ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
  }, [resolvedTheme]);

  useEffect(() => {
    void SplashScreen.hide();

    const handleUrl = async (url: string) => {
      if (handledUrls.has(url)) return;
      handledUrls.add(url);
      const result = await completeNativeGoogleSignIn(url);
      if (result.handled) {
        if (result.error) toast.error(result.error);
        return;
      }
      const path = toAppPath(url);
      if (path) navigate(path);
    };

    const openLink = (link: unknown) => {
      const path = toAppPath(link);
      if (path) navigate(path);
      else if (typeof link === "string" && /^https:\/\//.test(link)) void Browser.open({ url: link });
    };

    const listeners = [
      App.addListener("appUrlOpen", ({ url }) => void handleUrl(url)),
      App.addListener("backButton", ({ canGoBack }) => {
        if (closeOpenOverlay()) return;
        if (canGoBack) window.history.back();
        else void App.minimizeApp();
      }),
      FirebaseMessaging.addListener("notificationActionPerformed", ({ notification }) => {
        openLink((notification.data as { url?: string } | undefined)?.url);
      }),
      // Android visar inte notiser när appen är öppen; iOS visar dem själv (presentationOptions).
      FirebaseMessaging.addListener("notificationReceived", ({ notification }) => {
        if (nativePlatform() !== "android") return;
        const link = (notification.data as { url?: string } | undefined)?.url;
        toast(notification.title ?? "SHF Intra", {
          description: notification.body,
          action: link ? { label: "Visa", onClick: () => openLink(link) } : undefined,
        });
      }),
    ];

    void App.getLaunchUrl().then((launch) => {
      if (launch?.url) void handleUrl(launch.url);
    });

    if (nativePlatform() === "android") {
      void FirebaseMessaging.createChannel({
        id: NOTIFICATION_CHANNEL_ID,
        name: "SHF Intra",
        description: "Beställningar, uppgifter och meddelanden",
        importance: Importance.High,
      }).catch((error) => console.warn("Notification channel failed", error));
    }

    return () => {
      for (const listener of listeners) void listener.then((handle) => handle.remove());
    };
  }, [navigate]);

  return null;
}
