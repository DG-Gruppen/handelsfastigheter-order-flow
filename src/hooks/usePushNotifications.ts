import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Publik VAPID-nyckel (publicerbar, får ligga i koden)
export const VAPID_PUBLIC_KEY =
  "BG6snRcxjeGkDkonqiOXEB6t2vlsOhbJb-iOnbUM9q6A8tzJjQAd9Ss99ud5EIFR-15tBNO06fcJF2vj-GofiA4";

const SW_URL = "/push-sw.js";

export type PushState =
  | "loading"
  | "unsupported"
  | "needs-install"
  | "denied"
  | "off"
  | "on";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supported) {
        setState(isIos() && !isStandalone() ? "needs-install" : "unsupported");
        return;
      }
      // iOS kräver att appen är installerad på hemskärmen
      if (isIos() && !isStandalone()) {
        setState("needs-install");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration(SW_URL);
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!cancelled) setState(sub ? "on" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    if (!user) return { ok: false, reason: "no-user" as const };
    if (window.top !== window.self) return { ok: false, reason: "iframe" as const };
    setBusy(true);
    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return { ok: false, reason: "denied" as const };
      }

      const reg = await navigator.serviceWorker.register(SW_URL);
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh,
          auth: json.keys!.auth,
          user_agent: navigator.userAgent.slice(0, 300),
        } as never,
        { onConflict: "endpoint" },
      );
      if (error) return { ok: false, reason: "save-failed" as const };

      setState("on");
      return { ok: true as const };
    } catch (e) {
      console.error("Push enable failed", e);
      return { ok: false, reason: "error" as const };
    } finally {
      setBusy(false);
    }
  }, [user]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      return { ok: true as const };
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    if (!user) return false;
    const { error } = await supabase.functions.invoke("send-push", {
      body: {
        user_id: user.id,
        title: "Testnotis från SHF Intra",
        body: "Push-notiser fungerar på den här enheten.",
        url: "/dashboard",
      },
    });
    return !error;
  }, [user]);

  return { state, busy, enable, disable, sendTest, isIos: isIos() };
}
