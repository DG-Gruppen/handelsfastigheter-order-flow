import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import type { PaketItem } from "@/lib/lcc/paket";

export type Category = "" | "BRAND" | "BV" | "LED" | "PV" | "VÅV" | "VENT";

type Ctx = {
  // Vald fastighet/åtgärd i CalcView (delas så Prio kan navigera dit)
  fastighetVis: string;
  setFastighetVis: (v: string) => void;
  atgardIdx: string;
  setAtgardIdx: (v: string) => void;

  // Kategori-snabbfilter
  category: Category;
  setCategory: (c: Category) => void;

  // Paket
  paket: PaketItem[];
  paketFastighet: string | null;
  paketAdd: (item: PaketItem) => void;
  paketRemove: (i: number) => void;
  paketClear: (silent?: boolean) => void;

  // Aktiv flik (intro/lcc/prio/paket)
  tab: string;
  setTab: (t: string) => void;
};

const LccCtx = createContext<Ctx | null>(null);

export function LccProvider({ children, defaultFastighet }: { children: ReactNode; defaultFastighet: string }) {
  const [fastighetVis, setFastighetVis] = useState<string>(defaultFastighet);
  const [atgardIdx, setAtgardIdx] = useState<string>("");
  const [category, setCategory] = useState<Category>("");
  const [paket, setPaket] = useState<PaketItem[]>([]);
  const [paketFastighet, setPaketFastighet] = useState<string | null>(null);
  const [tab, setTab] = useState<string>(() => {
    if (typeof window === "undefined") return "intro";
    const h = window.location.hash.replace("#", "");
    return ["intro", "lcc", "prio", "paket"].includes(h) ? h : "intro";
  });

  const paketAdd = useCallback((item: PaketItem) => {
    if (!item.fastighet || item.fastighet.startsWith("VALFRI")) {
      toast({ title: "Åtgärdspaket kräver en vald fastighet med ED-data.", variant: "destructive" });
      return;
    }
    if (paketFastighet && paketFastighet !== item.fastighet) {
      const ok = window.confirm(
        `Paketet gäller ${paketFastighet}. Töm paketet och starta nytt för ${item.fastighet}?`
      );
      if (!ok) return;
      setPaket([item]);
      setPaketFastighet(item.fastighet);
      toast({ title: "Nytt paket startat", description: item.atgard });
      return;
    }
    if (paket.some((p) => p.atgard === item.atgard)) {
      toast({ title: "Åtgärden finns redan i paketet." });
      return;
    }
    setPaket((prev) => [...prev, item]);
    setPaketFastighet(item.fastighet);
    toast({ title: "Tillagd i paket", description: item.atgard });
  }, [paket, paketFastighet]);

  const paketRemove = useCallback((i: number) => {
    setPaket((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      if (next.length === 0) setPaketFastighet(null);
      return next;
    });
  }, []);

  const paketClear = useCallback((silent?: boolean) => {
    if (!silent && paket.length > 0 && !window.confirm("Töm hela paketet?")) return;
    setPaket([]);
    setPaketFastighet(null);
  }, [paket.length]);

  return (
    <LccCtx.Provider value={{
      fastighetVis, setFastighetVis,
      atgardIdx, setAtgardIdx,
      category, setCategory,
      paket, paketFastighet, paketAdd, paketRemove, paketClear,
      tab, setTab,
    }}>{children}</LccCtx.Provider>
  );
}

export function useLcc() {
  const ctx = useContext(LccCtx);
  if (!ctx) throw new Error("useLcc must be used within LccProvider");
  return ctx;
}
