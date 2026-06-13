import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ArrowUpDown } from "lucide-react";
import { FASTIGHETER_RAW, EPBD_TROSKEL_2030, EPBD_TROSKEL_2033 } from "@/lib/lcc/calc";
import { useLcc } from "./lcc-context";

type SortKey = "prio" | "pet" | "atemp" | "namn" | "klass" | "kom";

/** Prioritetspoäng: PET över 2033-tröskel × Atemp / 1000 (samma logik som originalet). */
function priorityScore(pet: number | null, atemp: number | null, e30: string | null, e33: string | null) {
  const over = Math.max(0, (pet || 0) - EPBD_TROSKEL_2033);
  const flagBoost = (e33 === "JA" ? 25 : 0) + (e30 === "JA" ? 15 : 0);
  return Math.round((over * (atemp || 0)) / 1000) + flagBoost;
}

function priorityBucket(score: number): "hog" | "med" | "lag" {
  if (score >= 50) return "hog";
  if (score >= 25) return "med";
  return "lag";
}

export default function PrioView() {
  const { setFastighetVis, setAtgardIdx, setTab } = useLcc();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string>("");
  const [epbdFilter, setEpbdFilter] = useState<string>("");
  const [klassFilter, setKlassFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("prio");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const regions = useMemo(() => {
    const s = new Set<string>();
    FASTIGHETER_RAW.forEach((f) => { if (f.reg) s.add(f.reg); });
    return Array.from(s).sort();
  }, []);

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const data = FASTIGHETER_RAW
      .filter((f) => f.nr !== "VALFRI" && f.pet !== null)
      .map((f) => ({ f, score: priorityScore(f.pet, f.atemp, f.e30, f.e33) }));

    const filtered = data.filter((d) => {
      if (region && d.f.reg !== region) return false;
      if (epbdFilter === "2030" && d.f.e30 !== "JA") return false;
      if (epbdFilter === "2033" && d.f.e33 !== "JA") return false;
      if (klassFilter && d.f.klass !== klassFilter) return false;
      if (ql && !`${d.f.vis} ${d.f.kom} ${d.f.reg}`.toLowerCase().includes(ql)) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      switch (sortKey) {
        case "prio": av = a.score; bv = b.score; break;
        case "pet": av = a.f.pet || 0; bv = b.f.pet || 0; break;
        case "atemp": av = a.f.atemp || 0; bv = b.f.atemp || 0; break;
        case "klass": av = a.f.klass || "Z"; bv = b.f.klass || "Z"; break;
        case "namn": av = a.f.vis; bv = b.f.vis; break;
        case "kom": av = a.f.kom || ""; bv = b.f.kom || ""; break;
      }
      if (typeof av === "string") return (av as string).localeCompare(bv as string) * sortDir;
      return ((av as number) - (bv as number)) * sortDir;
    });
  }, [q, region, epbdFilter, klassFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === 1 ? -1 : 1);
    else { setSortKey(k); setSortDir(k === "namn" || k === "kom" || k === "klass" ? 1 : -1); }
  };

  const openInCalc = (vis: string) => {
    setFastighetVis(vis);
    setAtgardIdx("");
    setTab("lcc");
  };

  return (
    <Card className="p-4 md:p-5 space-y-4">
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="font-heading text-lg font-bold text-foreground">Prioriteringslista</h3>
          <p className="text-xs text-muted-foreground">
            Rangordnad efter EPBD-flagga + hög PET × Atemp. Visar {rows.length} fastigheter. Klicka en rad för att öppna i Kalkyl.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Select value={region || "ALL"} onValueChange={(v) => setRegion(v === "ALL" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Alla regioner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alla regioner</SelectItem>
              {regions.map((r) => <SelectItem key={r} value={r}>Region {r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={epbdFilter || "ALL"} onValueChange={(v) => setEpbdFilter(v === "ALL" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Alla EPBD" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alla EPBD-status</SelectItem>
              <SelectItem value="2030">Klarar ej EPBD 2030</SelectItem>
              <SelectItem value="2033">Klarar ej EPBD 2033</SelectItem>
            </SelectContent>
          </Select>
          <Select value={klassFilter || "ALL"} onValueChange={(v) => setKlassFilter(v === "ALL" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Alla klasser" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alla energiklasser</SelectItem>
              {["A", "B", "C", "D", "E", "F", "G"].map((k) => <SelectItem key={k} value={k}>Klass {k}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Sök fastighet…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground font-semibold uppercase tracking-wide">Prioritetsfärg:</span>
          <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 border">🔴 Hög ≥50</Badge>
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 border">🟡 Medel 25–49</Badge>
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 border">🟢 Låg &lt;25</Badge>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead k="prio" current={sortKey} dir={sortDir} onClick={toggleSort} align="right">Prio</SortHead>
              <SortHead k="namn" current={sortKey} dir={sortDir} onClick={toggleSort}>Fastighet</SortHead>
              <SortHead k="kom" current={sortKey} dir={sortDir} onClick={toggleSort}>Kommun</SortHead>
              <TableHead className="hidden md:table-cell">Region</TableHead>
              <SortHead k="pet" current={sortKey} dir={sortDir} onClick={toggleSort} align="right">PET</SortHead>
              <SortHead k="klass" current={sortKey} dir={sortDir} onClick={toggleSort} align="center">Klass</SortHead>
              <SortHead k="atemp" current={sortKey} dir={sortDir} onClick={toggleSort} align="right">Atemp</SortHead>
              <TableHead className="text-center">EPBD 30/33</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 250).map(({ f, score }) => {
              const bucket = priorityBucket(score);
              const rowCls =
                bucket === "hog" ? "border-l-4 border-l-red-500" :
                bucket === "med" ? "border-l-4 border-l-amber-500" :
                "border-l-4 border-l-emerald-500";
              return (
                <TableRow
                  key={f.vis}
                  className={`cursor-pointer hover:bg-muted/50 ${rowCls}`}
                  onClick={() => openInCalc(f.vis)}
                >
                  <TableCell className="text-right tabular-nums font-bold">{score}</TableCell>
                  <TableCell className="font-medium">
                    {f.vis}
                    <div className="text-xs text-muted-foreground md:hidden">{f.kom} · {f.reg}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{f.kom}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{f.reg}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.pet?.toLocaleString("sv") ?? "—"}</TableCell>
                  <TableCell className="text-center"><KlassPill klass={f.klass} /></TableCell>
                  <TableCell className="text-right tabular-nums">{f.atemp?.toLocaleString("sv") ?? "—"}</TableCell>
                  <TableCell className="text-center text-xs whitespace-nowrap">
                    <Badge variant={f.e30 === "JA" ? "destructive" : "secondary"} className="mr-1">{f.e30 === "JA" ? "30!" : "30 ✓"}</Badge>
                    <Badge variant={f.e33 === "JA" ? "destructive" : "secondary"}>{f.e33 === "JA" ? "33!" : "33 ✓"}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {rows.length > 250 && (
        <p className="text-xs text-muted-foreground text-center">
          Visar topp 250 av {rows.length}. Filtrera för att se fler.
        </p>
      )}
      <p className="text-xs text-muted-foreground font-mono">
        Visar {rows.length} fastigheter · sorterat efter prioritet (EPBD-flagga + hög PET × Atemp)
      </p>
    </Card>
  );
}

function SortHead({ k, current, dir, onClick, children, align = "left" }: {
  k: SortKey; current: SortKey; dir: 1 | -1; onClick: (k: SortKey) => void; children: React.ReactNode; align?: "left" | "right" | "center";
}) {
  const active = current === k;
  return (
    <TableHead className={align === "right" ? "text-right" : align === "center" ? "text-center" : ""}>
      <button onClick={() => onClick(k)} className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground font-semibold" : ""}`}>
        {children}
        <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-30"}`} />
        {active && <span className="text-xs">{dir === -1 ? "↓" : "↑"}</span>}
      </button>
    </TableHead>
  );
}

function KlassPill({ klass }: { klass: string | null }) {
  if (!klass) return <span className="text-muted-foreground">—</span>;
  const colors: Record<string, string> = {
    A: "bg-emerald-500 text-white",
    B: "bg-green-500 text-white",
    C: "bg-lime-500 text-white",
    D: "bg-yellow-500 text-black",
    E: "bg-orange-500 text-white",
    F: "bg-red-500 text-white",
    G: "bg-red-700 text-white",
  };
  return <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md font-bold ${colors[klass] || "bg-muted"}`}>{klass}</span>;
}
