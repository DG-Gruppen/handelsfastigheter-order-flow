import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Module slug mapping from route paths
const ROUTE_MODULE_MAP: Record<string, string> = {
  "/dashboard": "dashboard",
  "/orders/new": "bestallningar",
  "/history": "history",
  "/org": "organisationsschema",
  "/admin": "admin",
  "/it-info": "it-support",
  "/personal": "personal",
  "/dokument": "documents",
  "/kunskapsbanken": "kunskapsbanken",
  "/mitt-shf": "mitt-shf",
  "/planner": "planner",
  "/verktyg": "verktyg",
  "/losenord": "losenord",
  "/kulturen": "kulturen",
  "/nyheter": "nyheter",
  "/arbetsklader": "arbetsklader",
  "/statistik": "statistik",
  "/profile": "profile",
  "/onboarding": "onboarding",
};

/**
 * Generate a non-reversible session hash from user ID + date.
 * Changes daily so we can count unique daily visitors without identifying anyone.
 */
async function generateSessionHash(userId: string): Promise<string> {
  const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const raw = `${userId}-${dateKey}-anon-salt-shf-2024`;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function getModuleSlug(pathname: string): string | null {
  // Exact match first
  if (ROUTE_MODULE_MAP[pathname]) return ROUTE_MODULE_MAP[pathname];
  // Prefix match for nested routes like /orders/:id
  for (const [route, slug] of Object.entries(ROUTE_MODULE_MAP)) {
    if (pathname.startsWith(route + "/")) return slug;
  }
  return null;
}

/**
 * Tracks page visits anonymously. Logs:
 * - page_path (which page)
 * - module_slug (which module)
 * - session_hash (unique per user per day, non-reversible)
 * - duration_seconds (time spent on page)
 * - viewport_width (for responsive insights)
 * - referrer_path (previous page)
 */
export function usePageTracking() {
  const { user } = useAuth();
  const location = useLocation();
  const enteredAt = useRef<number>(Date.now());
  const prevPath = useRef<string | null>(null);
  const sessionHashRef = useRef<string | null>(null);

  // Generate session hash once per session
  useEffect(() => {
    if (!user) return;
    generateSessionHash(user.id).then(hash => {
      sessionHashRef.current = hash;
    });
  }, [user]);

  useEffect(() => {
    if (!user || !sessionHashRef.current) return;

    const currentPath = location.pathname;
    const now = Date.now();

    // Log duration of previous page
    if (prevPath.current && prevPath.current !== currentPath) {
      const durationSec = Math.round((now - enteredAt.current) / 1000);
      // Only log if spent at least 1 second (filter out instant redirects)
      if (durationSec >= 1 && durationSec < 3600) {
        const moduleSlug = getModuleSlug(prevPath.current);
        supabase.from("page_analytics").insert({
          page_path: prevPath.current,
          module_slug: moduleSlug,
          session_hash: sessionHashRef.current,
          duration_seconds: durationSec,
          referrer_path: null,
          viewport_width: window.innerWidth,
        }).then(() => {});
      }
    }

    // Reset timer for new page
    enteredAt.current = now;
    prevPath.current = currentPath;

    // Log the page view (duration 0, will be updated on leave)
    const moduleSlug = getModuleSlug(currentPath);
    supabase.from("page_analytics").insert({
      page_path: currentPath,
      module_slug: moduleSlug,
      session_hash: sessionHashRef.current,
      duration_seconds: 0,
      referrer_path: prevPath.current !== currentPath ? prevPath.current : null,
      viewport_width: window.innerWidth,
    }).then(() => {});

    // Log duration on page unload
    const handleBeforeUnload = () => {
      const dur = Math.round((Date.now() - enteredAt.current) / 1000);
      if (dur >= 1 && dur < 3600 && sessionHashRef.current) {
        // Use sendBeacon for reliability on page close
        const payload = JSON.stringify({
          page_path: currentPath,
          module_slug: moduleSlug,
          session_hash: sessionHashRef.current,
          duration_seconds: dur,
          viewport_width: window.innerWidth,
        });
        // Fallback: fire-and-forget insert
        navigator.sendBeacon?.(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/page_analytics`, "");
        // The sendBeacon for Supabase REST API is tricky, so we just do a regular insert
        supabase.from("page_analytics").insert({
          page_path: currentPath,
          module_slug: moduleSlug,
          session_hash: sessionHashRef.current,
          duration_seconds: dur,
          viewport_width: window.innerWidth,
        }).then(() => {});
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [location.pathname, user, sessionHashRef.current]);
}
