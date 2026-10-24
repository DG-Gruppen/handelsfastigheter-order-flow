import { Capacitor } from "@capacitor/core";
import { getAppBaseUrl } from "@/lib/utils";

/** True när webbappen körs inuti Android- eller iOS-appen (Capacitor). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function nativePlatform(): "android" | "ios" | "web" {
  return Capacitor.getPlatform() as "android" | "ios" | "web";
}

/**
 * Adressen som ska stå i länkar som delas eller mejlas. I appen är
 * window.location.origin https://localhost (Android) eller capacitor://localhost (iOS).
 */
export function publicAppOrigin(): string {
  return isNativeApp() ? getAppBaseUrl() : window.location.origin;
}
