import { useMemo, useState } from "react";
import { units, fmtKr, fmtNum, fmtDate, type Unit } from "@/lib/rentroll";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { makeMatcher } from "@/lib/search";
import propertiesData from "@/data/properties.json";

const kommunByFastighet: Record<string, string> = Object.fromEntries(
  (propertiesData as { fastighet: string; kommun?: string }[]).map((p) => [p.fastighet, p.kommun || ""])
);

export function TenantsView() {
  const [q, setQ] = useState("");
  const [typFilter, setTypFilter] = useState("all");
  const [vakOnly, setVakOnly] = useState("all");

  const typeOptions = useMemo(
    () => Array.from(new Set(units.map((u) => u.typ).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "sv")),
    []
  );

  const rows = useMemo(() => {
    const match = makeMatcher(q);
    return units.filter((u) => {
      if (typFilter !== "all" && u.typ !== typFilter) return false;
      if (vakOnly === "vak" && !u.vak) return false;
      if (vakOnly === "uth" && u.vak) return false;
      return match([u.hg, u.fb, u.ort, u.vn_butik, u.vn_typ, u.gata, kommunByFastighet[u.fb]]);
    });
  }, [q, typFilter, vakOnly]);

  const totals = useMemo(() => {
    let area = 0, hyra = 0, vh = 0;
    rows.forEach((r) => { area += r.area || 0; hyra += r.hyra || 0; vh += r.vh || 0; });
    return { area, hyra, vh, count: rows.length };
  }, [rows]);

  return (
    <Card className="p-3 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_200px] gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök hyresgäst, fastighet, ort, kommun, kedja (wildcard: Ica*)" className="pl-8 h-9" />
        </div>
        <Select value={typFilter} onValueChange={setTypFilter}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Objektstyp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla objektstyper</SelectItem>
            {typeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={vakOnly} onValueChange={setVakOnly}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla status</SelectItem>
            <SelectItem value="uth">Endast uthyrda</SelectItem>
            <SelectItem value="vak">Endast vakanta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <StatBox label="Rader" value={fmtNum(totals.count)} />
        <StatBox label="Total area" value={fmtNum(totals.area, "m²")} />
        <StatBox label="Total hyra" value={fmtKr(totals.hyra)} />
        <StatBox label="Vakanshyra" value={fmtKr(totals.vh)} />
      </div>

      <div className="overflow-x-auto border rounded-md max-h-[65vh] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr className="text-left">
              <Th>Hyresgäst</Th>
              <Th>Fastighet</Th>
              <Th>Objektstyp</Th>
              <Th className="text-right">Area</Th>
              <Th className="text-right">Hyra</Th>
              <Th className="text-right">Kr/m²</Th>
              <Th>Kontrakt t.o.m.</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((u, i) => <TenantRow key={i} u={u} />)}
          </tbody>
        </table>
        {rows.length > 500 && (
          <div className="p-2 text-center text-xs text-muted-foreground border-t">
            Visar 500 av {rows.length} rader – filtrera för att smalna av.
          </div>
        )}
      </div>
    </Card>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={"px-2 py-1.5 font-semibold whitespace-nowrap " + className}>{children}</th>;
}
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
function TenantRow({ u }: { u: Unit }) {
  return (
    <tr className="border-t hover:bg-accent/30">
      <td className="px-2 py-1.5">{u.hg || <span className="italic text-muted-foreground">Vakant</span>}</td>
      <td className="px-2 py-1.5 whitespace-nowrap">{u.fb}</td>
      <td className="px-2 py-1.5">{u.typ || "–"}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(u.area)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{fmtKr(u.hyra)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(u.krm2)}</td>
      <td className="px-2 py-1.5 whitespace-nowrap">{fmtDate(u.to)}</td>
      <td className="px-2 py-1.5">
        {u.vak ? <Badge variant="destructive" className="text-[10px]">Vakant</Badge> : <Badge variant="secondary" className="text-[10px]">Uthyrd</Badge>}
      </td>
    </tr>
  );
}
