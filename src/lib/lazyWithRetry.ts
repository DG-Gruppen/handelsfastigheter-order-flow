import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "chunk_reload_at";

/**
 * React.lazy med skydd mot "Failed to fetch dynamically imported module".
 * Uppstår när en ny version deployats och klienten har en gammal index-fil
 * som pekar på chunk-namn som inte längre finns. Vi försöker en gång till,
 * och laddar annars om sidan (max en gång per minut för att undvika loop).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      try {
        return await factory();
      } catch {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last > 60_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
        throw err;
      }
    }
  });
}
