import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  getExistingToken,
  isFirebaseConfigured,
  pushSupported,
  removeToken,
  requestToken,
} from "@/lib/firebasePush";
import { isInStandaloneMode, isIos } from "@/lib/pwa";

export type PushState =
  | "loading"
  | "unsupported"
  | "needs-install"
  | "denied"
  | "off"
  | "on";

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isIos() && !isStandalone()) {
        if (!cancelled) setState("needs-install");
        return;
      }
      if (!isFirebaseConfigured() || !(await pushSupported())) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      if (Notification.permission !== "granted") {
        if (!cancelled) setState("off");
        return;
      }
      const token = await getExistingToken();
      if (cancelled) return;
      if (!token || !user) {
        setState(token ? "on" : "off");
        return;
      }
      const { data } = await supabase
        .from("fcm_tokens")
        .select("id")
        .eq("token", token)
        .maybeSingle();
      if (!cancelled) setState(data ? "on" : "off");
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const enable = useCallback(async () => {
    if (!user) return { ok: false, reason: "no-user" as const };
    if (window.top !== window.self) return { ok: false, reason: "iframe" as const };
    setBusy(true);
    try {
      const res = await requestToken();
      if (res.status !== "registered") {
        setState(res.status === "denied" ? "denied" : "off");
        return { ok: false, reason: res.status === "denied" ? ("denied" as const) : ("error" as const) };
      }

      const { error } = await supabase.from("fcm_tokens").upsert(
        {
          user_id: user.id,
          token: res.token,
          user_agent: navigator.userAgent.slice(0, 300),
        } as never,
        { onConflict: "token" },
      );
      if (error) {
        console.error("Kunde inte spara enheten", error);
        return { ok: false, reason: "save-failed" as const };
      }

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
      const token = await getExistingToken();
      if (token) {
        await supabase.from("fcm_tokens").delete().eq("token", token);
        await removeToken();
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
    if (error) console.error("Testnotis misslyckades", error);
    return !error;
  }, [user]);

  return { state, busy, enable, disable, sendTest, isIos: isIos() };
}
