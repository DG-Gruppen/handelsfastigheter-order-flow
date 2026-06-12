import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowUpDown } from "lucide-react";
import { FASTIGHETER_RAW, EPBD_TROSKEL_2030, EPBD_TROSKEL_2033 } from "@/lib/lcc/calc";

type SortKey = "prio" | "pet" | "atemp" | "namn" | "klass";

export default function PrioView() {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("prio");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const data = FASTIGHETER_RAW.filter((f) => f.nr !== "VALFRI" && f.pet !== null).map((f) => {
      const over2033 = Math.max(0, (f.pet || 0) - EPBD_TROSKEL_2033);
      const prio = over2033 * (f.atemp || 0); // kvh/m² över tröskel × m² ≈ potential
      return { f, prio, over2033 };
    });
    const filtered = ql
      ? data.filter((d) => `${d.f.vis} ${d.f.kom} ${d.f.reg}`.toLowerCase().includes(ql))
      : data;
    return filtered.sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      switch (sortKey) {
        case "prio": av = a.prio; bv = b.prio; break;
        case "pet": av = a.f.pet || 0; bv = b.f.pet || 0; break;
        case "atemp": av = a.f.atemp || 0; bv = b.f.atemp || 0; break;
        case "klass": av = a.f.klass || ""; bv = b.f.klass || ""; break;
        case "namn": av = a.f.vis; bv = b.f.vis; break;
      }
      if (typeof av === "string") return av.localeCompare(bv as string) * sortDir;
      return ((av as number) - (bv as number)) * sortDir;
    });
  }, [q, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === 1 ? -1 : 1);
    else { setSortKey(k); setSortDir(-1); }
  };

  return (
    <Card className="p-4 md:p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-bold text-foreground">Prioriteringslista</h3>
          <p className="text-xs text-muted-foreground">
            Sorterad efter åtgärdspotential (PET över EPBD 2033 × Atemp). Visar {rows.length} fastigheter.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök fastighet, kommun, region…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead k="namn" current={sortKey} dir={sortDir} onClick={toggleSort}>Fastighet</SortHead>
              <TableHead className="hidden md:table-cell">Region</TableHead>
              <SortHead k="atemp" current={sortKey} dir={sortDir} onClick={toggleSort} align="right">Atemp (m²)</SortHead>
              <SortHead k="pet" current={sortKey} dir={sortDir} onClick={toggleSort} align="right">PET</SortHead>
              <SortHead k="klass" current={sortKey} dir={sortDir} onClick={toggleSort} align="center">Klass</SortHead>
              <TableHead className="text-center">EPBD 30/33</TableHead>
              <SortHead k="prio" current={sortKey} dir={sortDir} onClick={toggleSort} align="right">Potential</SortHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 200).map(({ f, prio }) => (
              <TableRow key={f.vis}>
                <TableCell className="font-medium">{f.vis}<div className="text-xs text-muted-foreground md:hidden">{f.kom} · {f.reg}</div></TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{f.kom} · {f.reg}</TableCell>
                <TableCell className="text-right tabular-nums">{f.atemp?.toLocaleString("sv") ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{f.pet?.toLocaleString("sv") ?? "—"}</TableCell>
                <TableCell className="text-center"><KlassPill klass={f.klass} /></TableCell>
                <TableCell className="text-center text-xs">
                  <Badge variant={f.e30 === "JA" ? "destructive" : "secondary"} className="mr-1">{f.e30 === "JA" ? "30!" : "30 ✓"}</Badge>
                  <Badge variant={f.e33 === "JA" ? "destructive" : "secondary"}>{f.e33 === "JA" ? "33!" : "33 ✓"}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{Math.round(prio).toLocaleString("sv")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {rows.length > 200 && (
        <p className="text-xs text-muted-foreground text-center">Visar topp 200 av {rows.length}. Filtrera för att se fler.</p>
      )}
    </Card>
  );
}

function SortHead({ k, current, dir, onClick, children, align = "left" }: { k: SortKey; current: SortKey; dir: 1 | -1; onClick: (k: SortKey) => void; children: React.ReactNode; align?: "left" | "right" | "center" }) {
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
