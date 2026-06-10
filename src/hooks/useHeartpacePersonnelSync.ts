import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "heartpace-personnel-sync-at";
const THROTTLE_MS = 5 * 60 * 1000;

let inFlight: Promise<void> | null = null;

export async function runHeartpacePersonnelSync(qc?: {
  invalidateQueries: (opts: { queryKey: unknown[] }) => Promise<unknown>;
}) {
  const { data, error } = await supabase.functions.invoke(
    "heartpace-sync-personnel",
    { body: {} },
  );
  if (error) throw error;
  sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  if (qc) {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["profiles"] }),
      qc.invalidateQueries({ queryKey: ["all-profiles"] }),
      qc.invalidateQueries({ queryKey: ["personnel"] }),
      qc.invalidateQueries({ queryKey: ["org-tree"] }),
    ]);
  }
  return data as {
    updated?: number;
    unchanged?: number;
    no_match?: number;
    field_changes?: Record<string, number>;
  };
}

export function useHeartpacePersonnelSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const last = Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
    if (Date.now() - last < THROTTLE_MS) return;
    if (inFlight) return;
    inFlight = (async () => {
      try {
        await runHeartpacePersonnelSync(qc);
      } catch (err) {
        console.warn("[heartpace-sync-personnel]", err);
      } finally {
        inFlight = null;
      }
    })();
  }, [qc]);
}
