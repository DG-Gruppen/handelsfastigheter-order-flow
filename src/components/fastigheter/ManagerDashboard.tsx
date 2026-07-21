import { useMemo, useState } from "react";
import { aggregates, units, fmtKr, fmtNum } from "@/lib/rentroll";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Mode = "forv" | "tf";

export function ManagerDashboard() {
  const [mode, setMode] = useState<Mode>("forv");

  const rows = useMemo(() => {
    const map = new Map<string, { name: string; fastigheter: Set<string>; objekt: number; vakanta: number; area: number; hyra: number; hvp: number }>();
    for (const [fb, a] of Object.entries(aggregates)) {
      const key = (mode === "forv" ? a.forv : a.tf) || "(saknas)";
      if (!map.has(key)) map.set(key, { name: key, fastigheter: new Set(), objekt: 0, vakanta: 0, area: 0, hyra: 0, hvp: 0 });
      const r = map.get(key)!;
      r.fastigheter.add(fb);
      r.objekt += a.objekt;
      r.vakanta += a.vakanta;
      r.area += a.area;
      r.hyra += a.hyra;
      r.hvp += a.hvp;
    }
    return Array.from(map.values())
      .map((r) => ({ ...r, antal_fastigheter: r.fastigheter.size }))
      .sort((a, b) => b.antal_fastigheter - a.antal_fastigheter);
  }, [mode]);

  

  const totals = useMemo(() => {
    const t = { objekt: 0, vakanta: 0, area: 0, hyra: 0, hvp: 0, antal_fastigheter: 0 };
    rows.forEach((r) => {
      t.objekt += r.objekt; t.vakanta += r.vakanta; t.area += r.area;
      t.hyra += r.hyra; t.hvp += r.hvp; t.antal_fastigheter += r.antal_fastigheter;
    });
    return t;
  }, [rows]);

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-sm font-semibold">Fördelning per {mode === "forv" ? "förvaltare" : "teknisk förvaltare"}</div>
          <p className="text-xs text-muted-foreground">
            Antal fastigheter, objekt, area och hyresvärde ({units.length} objekt totalt).
          </p>
        </div>
        <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <SelectTrigger className="h-9 w-56 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="forv">Förvaltare</SelectItem>
            <SelectItem value="tf">Teknisk förvaltare</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        <StatBox label="Personer" value={fmtNum(rows.length)} />
        <StatBox label="Fastigheter" value={fmtNum(totals.antal_fastigheter)} />
        <StatBox label="Objekt" value={fmtNum(totals.objekt)} />
        <StatBox label="Vakanta" value={fmtNum(totals.vakanta)} />
        <StatBox label="Total area" value={fmtNum(totals.area, "m²")} />
      </div>

      <div className="overflow-x-auto border rounded-md max-h-[65vh] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr className="text-left">
              <th className="px-2 py-1.5 font-semibold">{mode === "forv" ? "Förvaltare" : "Teknisk förvaltare"}</th>
              <th className="px-2 py-1.5 font-semibold text-right">Fastigheter</th>
              <th className="px-2 py-1.5 font-semibold text-right">Objekt</th>
              <th className="px-2 py-1.5 font-semibold text-right">Vakanta</th>
              <th className="px-2 py-1.5 font-semibold text-right">Area (m²)</th>
              <th className="px-2 py-1.5 font-semibold text-right">Hyresvärde</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t hover:bg-accent/30">
                <td className="px-2 py-1.5 font-medium">{r.name}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(r.antal_fastigheter)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(r.objekt)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {r.vakanta > 0 ? <span className="text-[hsl(var(--destructive))] font-medium">{fmtNum(r.vakanta)}</span> : "–"}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(r.area)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtKr(r.hvp)}</td>
                <td className="px-2 py-1.5">
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(r.hvp / maxHvp) * 100}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
