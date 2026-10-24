import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { isNativeApp } from "@/lib/native/platform";

// I Android/iOS-appen används Firebase native (google-services.json / GoogleService-Info.plist)
// i stället för webbpush. Tokens hamnar i samma fcm_tokens-tabell och skickas av send-push.

const appId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID as string | undefined;
export const vapidKey = import.meta.env
  .VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY as string | undefined;

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY as string | undefined,
  projectId: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID as string | undefined,
  appId,
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export function isFirebaseConfigured() {
  if (isNativeApp()) return true;
  return Boolean(
    firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && vapidKey && firebaseConfig.messagingSenderId,
  );
}

const SW_URL = "/firebase-messaging-sw.js";

async function registerSw() {
  const query = new URLSearchParams(firebaseConfig as Record<string, string>).toString();
  return navigator.serviceWorker.register(`${SW_URL}?${query}`);
}

function messaging() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig as Record<string, string>);
  return getMessaging(app);
}

export async function pushPermission(): Promise<NotificationPermission> {
  if (!isNativeApp()) return Notification.permission;
  const { receive } = await FirebaseMessaging.checkPermissions();
  return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "default";
}

export async function pushSupported() {
  if (isNativeApp()) {
    try {
      return (await FirebaseMessaging.isSupported()).isSupported;
    } catch {
      return false;
    }
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/** Hämtar befintlig token utan att fråga om behörighet. */
export async function getExistingToken(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  if ((await pushPermission()) !== "granted") return null;
  if (isNativeApp()) {
    try {
      return (await FirebaseMessaging.getToken()).token || null;
    } catch {
      return null;
    }
  }
  try {
    const serviceWorkerRegistration = await registerSw();
    return await getToken(messaging(), { vapidKey: vapidKey!, serviceWorkerRegistration });
  } catch {
    return null;
  }
}

export async function requestToken(): Promise<
  { status: "registered"; token: string } | { status: "denied" | "error" }
> {
  if (isNativeApp()) return requestNativeToken();
  try {
    const permission =
      Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") return { status: "denied" };
    const serviceWorkerRegistration = await registerSw();
    await navigator.serviceWorker.ready;
    const token = await getToken(messaging(), { vapidKey: vapidKey!, serviceWorkerRegistration });
    return token ? { status: "registered", token } : { status: "error" };
  } catch (e) {
    console.error("FCM token failed", e);
    return { status: "error" };
  }
}

async function requestNativeToken(): Promise<
  { status: "registered"; token: string } | { status: "denied" | "error" }
> {
  try {
    const { receive } = await FirebaseMessaging.requestPermissions();
    if (receive !== "granted") return { status: "denied" };
    const { token } = await FirebaseMessaging.getToken();
    return token ? { status: "registered", token } : { status: "error" };
  } catch (e) {
    console.error("FCM token failed", e);
    return { status: "error" };
  }
}

export async function removeToken() {
  try {
    if (isNativeApp()) {
      await FirebaseMessaging.deleteToken();
      return;
    }
    await deleteToken(messaging());
  } catch {
    /* ignorera */
  }
}
