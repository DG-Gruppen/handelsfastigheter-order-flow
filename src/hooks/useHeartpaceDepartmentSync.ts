import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "heartpace-dept-sync-at";
const THROTTLE_MS = 5 * 60 * 1000; // 5 min

let inFlight: Promise<void> | null = null;

export function useHeartpaceDepartmentSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const last = Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
    if (Date.now() - last < THROTTLE_MS) return;
    if (inFlight) return;

    inFlight = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "heartpace-sync-departments",
          { body: {} },
        );
        if (error) throw error;
        sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
        const r = (data ?? {}) as {
          departments?: { inserted?: number; updated?: number; deleted?: number };
          profiles?: { updated?: number };
        };
        const changed =
          (r.departments?.inserted ?? 0) +
          (r.departments?.updated ?? 0) +
          (r.departments?.deleted ?? 0) +
          (r.profiles?.updated ?? 0);
        if (changed > 0) {
          await Promise.all([
            qc.invalidateQueries({ queryKey: ["departments"] }),
            qc.invalidateQueries({ queryKey: ["profiles"] }),
            qc.invalidateQueries({ queryKey: ["all-profiles"] }),
            qc.invalidateQueries({ queryKey: ["personnel"] }),
            qc.invalidateQueries({ queryKey: ["org-tree"] }),
          ]);
        }
      } catch (err) {
        console.warn("[heartpace-sync-departments]", err);
      } finally {
        inFlight = null;
      }
    })();
  }, [qc]);
}
