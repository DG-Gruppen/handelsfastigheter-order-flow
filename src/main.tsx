import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Tvinga cache-tömning på mobiler/PWA ──
// Bumpa CACHE_VERSION när du vill tvinga alla klienter (mobil + desktop) att rensa cache.
const CACHE_VERSION = "2026-06-15-2";
(async () => {
  try {
    const stored = localStorage.getItem("app_cache_version");
    if (stored !== CACHE_VERSION) {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(async (registration) => {
          try {
            await registration.update();
          } catch {
            await registration.unregister();
          }
        }));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      localStorage.setItem("app_cache_version", CACHE_VERSION);
      if (stored !== null) {
        location.reload();
        return;
      }
    }
  } catch (e) {
    console.warn("Cache cleanup failed", e);
  }
})();

createRoot(document.getElementById("root")!).render(<App />);

// Remove splash screen after React mounts
requestAnimationFrame(() => {
  const splash = document.getElementById("splash-screen");
  if (splash) {
    splash.classList.add("fade-out");
    setTimeout(() => splash.remove(), 500);
  }
});
