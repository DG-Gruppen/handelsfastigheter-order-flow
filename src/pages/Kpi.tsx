import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import { useKpiData, useKpiTypes, formatKpiValue, KpiRow, KpiType } from "@/hooks/useKpiData";
import { useRegions } from "@/hooks/useRegions";
import { useModulePermission } from "@/hooks/useModulePermission";
import KpiUploadDialog from "@/components/kpi/KpiUploadDialog";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const CURRENT_YEAR = 2026;
const CURRENT_QUARTER = 1;
const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

export default function Kpi() {
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [quarter, setQuarter] = useState<number>(CURRENT_QUARTER);
  const [compareYear, setCompareYear] = useState<number>(CURRENT_YEAR - 1);
  const [selectedKpiSlug, setSelectedKpiSlug] = useState<string>("driftnetto");

  const { data: kpiTypes = [] } = useKpiTypes();
  const { data: rows = [], isLoading } = useKpiData(year, quarter);
  const { data: compareRows = [] } = useKpiData(compareYear, quarter);
  const { regions } = useRegions();
  const { canView, canEdit, loading: permissionLoading } = useModulePermission("kpi");

  const selectedKpi = kpiTypes.find((k) => k.slug === selectedKpiSlug);

  // Group rows by region for KPI cards (exclude rows utan region, t.ex. Optioner som lagras som "Totalt")
  const regionMap = useMemo(() => {
    const map = new Map<string, { name: string; rows: KpiRow[] }>();
    for (const r of rows) {
      if (!r.region_id) continue;
      const key = r.region_id;
      const name = r.region_name ?? regions.find((reg) => reg.id === r.region_id)?.name ?? "Okänd";
      if (!map.has(key)) map.set(key, { name, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return map;
  }, [rows, regions]);

  // Chart data for the selected KPI: budget vs actual per region, plus prev year actual
  const chartData = useMemo(() => {
    if (!selectedKpi) return [];
    const data: any[] = [];
    for (const [key, { name, rows: rrows }] of regionMap) {
      const r = rrows.find((x) => x.kpi_type_id === selectedKpi.id);
      const prev = compareRows.find((x) => (x.region_id ?? x.region_name) === key && x.kpi_type_id === selectedKpi.id);
      data.push({
        region: name,
        Budget: r?.budget ?? 0,
        Utfall: r?.actual ?? 0,
        [`Utfall ${compareYear}`]: prev?.actual ?? 0,
      });
    }
    return data;
  }, [regionMap, compareRows, selectedKpi, compareYear]);

  if (permissionLoading) {
    return (
      <div className="container mx-auto py-10 max-w-3xl">
        <Card className="glass-card">
          <CardContent className="p-10 text-center space-y-2">
            <Activity className="h-8 w-8 text-muted-foreground/30 animate-pulse mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="container mx-auto py-10 max-w-3xl">
        <Card className="glass-card">
          <CardContent className="p-10 text-center space-y-2">
            <h1 className="text-xl font-bold font-heading">Ingen åtkomst</h1>
            <p className="text-sm text-muted-foreground">Du saknar behörighet att se KPI-modulen. Kontakta en administratör om du behöver åtkomst.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">KPI – Budget vs Utfall</h1>
          <p className="text-sm text-muted-foreground mt-1">Översikt per region och kvartal</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(quarter)} onValueChange={(v) => setQuarter(parseInt(v))}>
            <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">jmf med</span>
          <Select value={String(compareYear)} onValueChange={(v) => setCompareYear(parseInt(v))}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          {canEdit && <KpiUploadDialog defaultYear={year} defaultQuarter={quarter} />}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <Activity className="h-8 w-8 text-muted-foreground/30 animate-pulse" />
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <Card className="glass-card">
          <CardContent className="p-10 text-center">
            <p className="text-muted-foreground">Ingen KPI-data för Q{quarter} {year}.</p>
            {canEdit && <p className="text-sm text-muted-foreground mt-2">Klicka på "Ladda upp Excel" för att importera.</p>}
          </CardContent>
        </Card>
      )}

      {!isLoading && rows.length > 0 && (
        <>
          {/* Region cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from(regionMap.entries()).map(([key, { name, rows: rrows }]) => (
              <RegionCard key={key} name={name} rows={rrows} kpiTypes={kpiTypes} />
            ))}
          </div>

          {/* KPI selector + chart */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Jämförelse per region</CardTitle>
              <Select value={selectedKpiSlug} onValueChange={setSelectedKpiSlug}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {kpiTypes.map((k) => <SelectItem key={k.slug} value={k.slug}>{k.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="region" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v: any) => selectedKpi ? formatKpiValue(Number(v), selectedKpi.format, selectedKpi.unit) : v}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Budget" fill="hsl(var(--muted-foreground) / 0.5)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Utfall" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={`Utfall ${compareYear}`} fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function RegionCard({ name, rows, kpiTypes }: { name: string; rows: KpiRow[]; kpiTypes: KpiType[] }) {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {kpiTypes.map((kpi) => {
          const r = rows.find((x) => x.kpi_type_id === kpi.id);
          if (!r) return null;
          const diff = r.actual !== null && r.budget !== null ? r.actual - r.budget : null;
          const diffPct = diff !== null && r.budget ? (diff / r.budget) * 100 : null;
          const positive = diff !== null && (kpi.higher_is_better ? diff >= 0 : diff <= 0);
          const Icon = diff === null || Math.abs(diff) < 0.01 ? Minus : positive ? TrendingUp : TrendingDown;
          const color = diff === null ? "text-muted-foreground" : positive ? "text-accent" : "text-destructive";

          return (
            <div key={kpi.id} className="border-b border-border/50 last:border-0 pb-3 last:pb-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-muted-foreground">{kpi.name}</span>
                {diffPct !== null && (
                  <Badge variant="outline" className={`gap-1 ${color} border-current/30`}>
                    <Icon className="h-3 w-3" />
                    {diffPct > 0 ? "+" : ""}{diffPct.toFixed(1).replace(".", ",")}%
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold">{formatKpiValue(r.actual, kpi.format, kpi.unit)}</span>
                <span className="text-xs text-muted-foreground">budget {formatKpiValue(r.budget, kpi.format, kpi.unit)}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
