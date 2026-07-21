import { useMemo, useState } from "react";
import { units, fmtKr, fmtNum, fmtDate, daysUntil } from "@/lib/rentroll";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";

export function ContractsView() {
  const [horizon, setHorizon] = useState("365");

  const upcoming = useMemo(() => {
    const h = parseInt(horizon);
    return units
      .filter((u) => u.hg && !u.vak)
      .map((u) => {
        const d1 = daysUntil(u.ups_hv);
        const d2 = daysUntil(u.ups_hg);
        const d3 = daysUntil(u.to);
        const candidates = [d1, d2, d3].filter((x): x is number => x != null && x >= -30);
        const min = candidates.length ? Math.min(...candidates) : null;
        return { u, min };
      })
      .filter((r) => r.min != null && r.min <= h)
      .sort((a, b) => (a.min ?? 0) - (b.min ?? 0));
  }, [horizon]);

  const groups = useMemo(() => {
    const past = upcoming.filter((r) => (r.min ?? 0) < 0);
    const soon = upcoming.filter((r) => (r.min ?? 0) >= 0 && (r.min ?? 0) <= 90);
    const later = upcoming.filter((r) => (r.min ?? 0) > 90);
    return { past, soon, later };
  }, [upcoming]);

  return (
    <Card className="p-3 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-sm font-semibold">Kontrakts- & uppsägningsbevakning</div>
          <p className="text-xs text-muted-foreground">
            Kontrakt vars uppsägnings- eller slutdatum närmar sig. Datum kommer från Rent-roll 260501.
          </p>
        </div>
        <Select value={horizon} onValueChange={setHorizon}>
          <SelectTrigger className="h-9 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="90">Nästa 3 månader</SelectItem>
            <SelectItem value="180">Nästa 6 månader</SelectItem>
            <SelectItem value="365">Nästa 12 månader</SelectItem>
            <SelectItem value="730">Nästa 24 månader</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        <SummaryBox icon={<AlertTriangle className="h-4 w-4" />} tone="destructive" label="Passerade / kritiska" value={groups.past.length} />
        <SummaryBox icon={<Clock className="h-4 w-4" />} tone="warning" label="Inom 90 dagar" value={groups.soon.length} />
        <SummaryBox icon={<CheckCircle2 className="h-4 w-4" />} tone="ok" label="Längre fram" value={groups.later.length} />
      </div>

      <div className="overflow-x-auto border rounded-md max-h-[60vh] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr className="text-left">
              <th className="px-2 py-1.5 font-semibold">Dagar</th>
              <th className="px-2 py-1.5 font-semibold">Hyresgäst</th>
              <th className="px-2 py-1.5 font-semibold">Fastighet</th>
              <th className="px-2 py-1.5 font-semibold">Ups. hyresvärd</th>
              <th className="px-2 py-1.5 font-semibold">Ups. hyresgäst</th>
              <th className="px-2 py-1.5 font-semibold">Kontrakt t.o.m.</th>
              <th className="px-2 py-1.5 font-semibold text-right">Hyra</th>
              <th className="px-2 py-1.5 font-semibold text-right">Area</th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map(({ u, min }, i) => (
              <tr key={i} className="border-t hover:bg-accent/30">
                <td className="px-2 py-1.5">
                  <Badge variant={min! < 0 ? "destructive" : min! <= 90 ? "default" : "secondary"} className="text-[10px] tabular-nums">
                    {min! < 0 ? `${Math.abs(min!)}d sen` : `${min}d`}
                  </Badge>
                </td>
                <td className="px-2 py-1.5">{u.hg}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{u.fb}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{fmtDate(u.ups_hv)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{fmtDate(u.ups_hg)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{fmtDate(u.to)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtKr(u.hyra)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(u.area)}</td>
              </tr>
            ))}
            {upcoming.length === 0 && (
              <tr><td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">Inga kontrakt inom valt intervall.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SummaryBox({ icon, tone, label, value }: { icon: React.ReactNode; tone: "destructive" | "warning" | "ok"; label: string; value: number }) {
  const cls = tone === "destructive"
    ? "border-[hsl(var(--destructive))]/40 text-[hsl(var(--destructive))]"
    : tone === "warning"
    ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
    : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400";
  return (
    <div className={"rounded-md border-2 bg-background px-3 py-2 flex items-center gap-3 " + cls}>
      {icon}
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-lg font-bold tabular-nums text-foreground">{value}</div>
      </div>
    </div>
  );
}
