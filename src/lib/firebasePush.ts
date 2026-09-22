import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging";

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

export async function pushSupported() {
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
  if (Notification.permission !== "granted") return null;
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

export async function removeToken() {
  try {
    await deleteToken(messaging());
  } catch {
    /* ignorera */
  }
}
