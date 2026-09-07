import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import {
  useKpiYearData,
  useKpiTypes,
  formatKpiValue,
  FLOW_KPI_SLUGS,
  KpiRow,
  KpiType,
} from "@/hooks/useKpiData";
import { useModulePermission } from "@/hooks/useModulePermission";
import KpiUploadDialog from "@/components/kpi/KpiUploadDialog";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const CURRENT_YEAR = 2026;
const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

const TOTAL_REGION = "Totalt";
const REGION_ORDER = [TOTAL_REGION, "Region Nord", "Region Mitt", "Region Syd", "Afu + Elimineringar"];

/** KPI:er som visas separat längst ned (inte per region) */
const FOOTER_SLUGS = ["optioner"];

interface Cell {
  budget: number | null;
  actual: number | null;
  stretch: number | null;
  /** Sant när ett ackumulerat värde saknar ett eller flera kvartal. */
  incomplete?: boolean;
  missingQuarters?: number[];
  /** Sant när "Hela bolaget" räknats fram som summan av regionerna. */
  derived?: boolean;
}

type RegionData = Map<string, Map<string, Cell>>; // region -> kpiTypeId -> Cell


function regionKey(r: KpiRow): string {
  return r.region_name ?? "Okänd";
}

function sortRegions(a: string, b: string) {
  const ia = REGION_ORDER.indexOf(a);
  const ib = REGION_ORDER.indexOf(b);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b, "sv");
}

function num(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const abs = Math.abs(v);
  const decimals = abs >= 1000 ? 0 : abs >= 10 ? 1 : 2;
  return v.toFixed(decimals).replace(".", ",");
}

/** Skillnad formaterad enligt KPI-typ: procentenheter för procent, annars i enhet. */
function formatDiff(diff: number, kpi: KpiType): string {
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  const v = Math.abs(diff);
  if (kpi.format === "percent") return `${sign}${v.toFixed(1).replace(".", ",")} p.p.`;
  if (kpi.format === "count") return `${sign}${num(v)} ${kpi.unit}`;
  return `${sign}${num(v)} ${kpi.unit}`;
}

export default function Kpi() {
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [period, setPeriod] = useState<string>("1");
  const [selectedKpiSlug, setSelectedKpiSlug] = useState<string>("driftnetto");

  const { data: kpiTypes = [] } = useKpiTypes();
  const { data: yearRows = [], isLoading } = useKpiYearData(year);
  const { canView, canEdit, loading: permissionLoading } = useModulePermission("kpi");

  const typeById = useMemo(() => new Map(kpiTypes.map((t) => [t.id, t])), [kpiTypes]);
  const regionKpiTypes = useMemo(
    () => kpiTypes.filter((t) => !FOOTER_SLUGS.includes(t.slug)),
    [kpiTypes],
  );
  const selectedKpi = regionKpiTypes.find((k) => k.slug === selectedKpiSlug) ?? regionKpiTypes[0];

  const quartersWithData = useMemo(
    () => Array.from(new Set(yearRows.map((r) => r.quarter))).sort((a, b) => a - b),
    [yearRows],
  );

  const isYtd = period === "ytd";
  const quarter = isYtd ? (quartersWithData[quartersWithData.length - 1] ?? 1) : parseInt(period);

  /** kvartal -> region -> kpi -> värde. "Hela bolaget" härleds ur regionerna om raden saknas. */
  const byQuarter = useMemo(() => {
    const out = new Map<number, RegionData>();
    for (const r of yearRows) {
      const type = typeById.get(r.kpi_type_id);
      if (!type) continue;
      if (!out.has(r.quarter)) out.set(r.quarter, new Map());
      const regions = out.get(r.quarter)!;
      const reg = regionKey(r);
      if (!regions.has(reg)) regions.set(reg, new Map());
      regions.get(reg)!.set(r.kpi_type_id, { budget: r.budget, actual: r.actual, stretch: r.stretch });
    }

    for (const regions of out.values()) {
      const total = regions.get(TOTAL_REGION) ?? new Map<string, Cell>();
      for (const type of typeById.values()) {
        if (total.has(type.id)) continue;
        // Andelar (procent) kan inte summeras – de härleds inte.
        if (type.format === "percent") continue;
        const acc: Cell = { budget: null, actual: null, stretch: null, derived: true };
        let any = false;
        for (const [reg, cells] of regions) {
          if (reg === TOTAL_REGION) continue;
          const c = cells.get(type.id);
          if (!c) continue;
          any = true;
          acc.budget = sum(acc.budget, c.budget);
          acc.actual = sum(acc.actual, c.actual);
          acc.stretch = sum(acc.stretch, c.stretch);
        }
        if (any) total.set(type.id, acc);
      }
      if (total.size > 0) regions.set(TOTAL_REGION, total);
    }
    return out;
  }, [yearRows, typeById]);

  /** Aggregerar till region -> kpi -> värde för vald period. */
  const data: RegionData = useMemo(() => {
    if (!isYtd) return byQuarter.get(quarter) ?? new Map();

    const quarters = Array.from({ length: quarter }, (_, i) => i + 1);
    const allRegions = new Set<string>();
    for (const q of quarters) for (const reg of byQuarter.get(q)?.keys() ?? []) allRegions.add(reg);

    const out: RegionData = new Map();
    for (const reg of allRegions) {
      const byKpi = new Map<string, Cell>();
      for (const type of typeById.values()) {
        if (FLOW_KPI_SLUGS.includes(type.slug)) {
          // Flöden summeras – och saknade kvartal markeras istället för att döljas.
          const acc: Cell = { budget: null, actual: null, stretch: null };
          const missing: number[] = [];
          let any = false;
          let derived = false;
          for (const q of quarters) {
            const c = byQuarter.get(q)?.get(reg)?.get(type.id);
            if (!c || c.actual === null || c.actual === undefined) {
              missing.push(q);
              continue;
            }
            any = true;
            derived = derived || !!c.derived;
            acc.actual = sum(acc.actual, c.actual);
            acc.budget = sum(acc.budget, c.budget);
            acc.stretch = sum(acc.stretch, c.stretch);
          }
          if (!any) continue;
          byKpi.set(type.id, { ...acc, derived, incomplete: missing.length > 0, missingQuarters: missing });
        } else {
          // Ögonblicksvärde: senaste kvartalet som faktiskt har ett utfall.
          for (let i = quarters.length - 1; i >= 0; i--) {
            const c = byQuarter.get(quarters[i])?.get(reg)?.get(type.id);
            if (c && c.actual !== null && c.actual !== undefined) {
              byKpi.set(type.id, quarters[i] === quarter ? c : { ...c, incomplete: true, missingQuarters: [quarter] });
              break;
            }
          }
        }
      }
      if (byKpi.size > 0) out.set(reg, byKpi);
    }
    return out;
  }, [byQuarter, typeById, isYtd, quarter]);

  const regions = useMemo(
    () => Array.from(data.keys()).filter((r) => r !== TOTAL_REGION).sort(sortRegions),
    [data],
  );
  const totalCells = data.get(TOTAL_REGION);

  const chartData = useMemo(() => {
    if (!selectedKpi) return [];
    return [...regions, ...(totalCells ? [TOTAL_REGION] : [])].map((reg) => {
      const c = data.get(reg)?.get(selectedKpi.id);
      const usable = c && !c.incomplete ? c : undefined;
      return {
        region: reg.replace("Region ", "").replace("Afu + Elimineringar", "Afu + elim."),
        Utfall: usable?.actual ?? null,
        Budget: usable?.budget ?? null,
        Stretch: usable?.stretch ?? null,
        variance:
          usable && usable.actual !== null && usable.budget !== null ? usable.actual - usable.budget : null,
      };
    });
  }, [regions, totalCells, data, selectedKpi]);

  const chartHasStretch = chartData.some((d) => d.Stretch !== null && d.Stretch !== undefined);

  /** Nyckeltal som saknar kvartal i den valda perioden – visas som varning. */
  const incompleteNotes = useMemo(() => {
    const notes = new Map<string, Set<number>>();
    for (const cells of data.values()) {
      for (const [typeId, c] of cells) {
        if (!c.incomplete) continue;
        const name = typeById.get(typeId)?.name;
        if (!name) continue;
        if (!notes.has(name)) notes.set(name, new Set());
        for (const q of c.missingQuarters ?? []) notes.get(name)!.add(q);
      }
    }
    return Array.from(notes.entries()).map(([name, qs]) => ({
      name,
      quarters: Array.from(qs).sort((a, b) => a - b),
    }));
  }, [data, typeById]);

  const footerTypes = kpiTypes.filter((t) => FOOTER_SLUGS.includes(t.slug));



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

  const hasData = data.size > 0;

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">KPI – utfall mot budget och stretch</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isYtd
              ? `Ackumulerat hittills i år (Q1–Q${quarter}) ${year}`
              : `Q${quarter} ${year} – per region och för hela bolaget`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}
              <SelectItem value="ytd">YTD (ackumulerat)</SelectItem>
            </SelectContent>
          </Select>
          {canEdit && <KpiUploadDialog defaultYear={year} defaultQuarter={isYtd ? quarter : parseInt(period)} />}
        </div>
      </div>

      {isYtd && (
        <p className="text-xs text-muted-foreground -mt-3">
          Driftnetto, nettouthyrning och antal kontrakt summeras över kvartalen. Övriga nyckeltal är ögonblicksvärden och visar senaste kvartalet (Q{quarter}).
        </p>
      )}

      {!isLoading && incompleteNotes.length > 0 && (
        <Card className="glass-card border-destructive/40">
          <CardContent className="p-4 flex gap-3 items-start">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Ofullständigt underlag</p>
              <ul className="text-muted-foreground mt-1 space-y-0.5">
                {incompleteNotes.map((n) => (
                  <li key={n.name}>
                    {n.name} – siffror saknas för {n.quarters.map((q) => `Q${q}`).join(", ")}.
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-1">
                Berörda värden är markerade och räknas inte som avvikelse mot budget eller stretch.
              </p>
            </div>
          </CardContent>
        </Card>
      )}


      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <Activity className="h-8 w-8 text-muted-foreground/30 animate-pulse" />
        </div>
      )}

      {!isLoading && !hasData && (
        <Card className="glass-card">
          <CardContent className="p-10 text-center">
            <p className="text-muted-foreground">Ingen KPI-data för {isYtd ? `${year}` : `Q${quarter} ${year}`}.</p>
            {canEdit && <p className="text-sm text-muted-foreground mt-2">Klicka på "Ladda upp Excel" för att importera.</p>}
          </CardContent>
        </Card>
      )}

      {!isLoading && hasData && (
        <>
          {/* Hela bolaget */}
          {totalCells && (
            <Card className="glass-card border-primary/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  Hela bolaget
                  <Badge variant="secondary" className="font-normal">{isYtd ? `Q1–Q${quarter}` : `Q${quarter}`} {year}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                  {regionKpiTypes.map((kpi) => {
                    const c = totalCells.get(kpi.id);
                    if (!c) return null;
                    return <KpiBlock key={kpi.id} kpi={kpi} cell={c} large />;
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Per region */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {regions.map((reg) => (
              <Card key={reg} className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{reg}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {regionKpiTypes.map((kpi) => {
                    const c = data.get(reg)?.get(kpi.id);
                    if (!c) return null;
                    return (
                      <div key={kpi.id} className="border-b border-border/50 last:border-0 pb-3 last:pb-0">
                        <KpiBlock kpi={kpi} cell={c} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Graf */}
          {selectedKpi && (
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 gap-3 flex-wrap">
                <CardTitle className="text-base">Jämförelse per region</CardTitle>
                <Select value={selectedKpi.slug} onValueChange={setSelectedKpiSlug}>
                  <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {regionKpiTypes.map((k) => <SelectItem key={k.slug} value={k.slug}>{k.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 36, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="region" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(v: any) => formatKpiValue(Number(v), selectedKpi.format, selectedKpi.unit)}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Utfall" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="Utfall" position="top" fontSize={11} formatter={(v: any) => num(v)} />
                        <LabelList
                          dataKey="variance"
                          position="top"
                          offset={16}
                          fontSize={11}
                          content={(props: any) => {
                            const { x = 0, y = 0, width = 0, value } = props;
                            if (value === null || value === undefined) return null;
                            const positive = selectedKpi.higher_is_better ? value >= 0 : value <= 0;
                            return (
                              <text
                                x={Number(x) + Number(width) / 2}
                                y={Number(y) - 18}
                                textAnchor="middle"
                                fontSize={11}
                                fill={positive ? "hsl(var(--accent))" : "hsl(var(--destructive))"}
                              >
                                {formatDiff(Number(value), selectedKpi)}
                              </text>
                            );
                          }}
                        />
                      </Bar>
                      <Bar dataKey="Budget" name={selectedKpi.budget_label ?? "Budget"} fill="hsl(var(--muted-foreground) / 0.5)" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="Budget" position="top" fontSize={11} formatter={(v: any) => num(v)} />
                      </Bar>
                      {chartHasStretch && (
                        <Bar dataKey="Stretch" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="Stretch" position="top" fontSize={11} formatter={(v: any) => num(v)} />
                        </Bar>
                      )}

                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Siffran i färg ovanför utfallsstapeln visar avvikelsen mot {(selectedKpi.budget_label ?? "budget").toLowerCase()}.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Optionsprogram m.m. */}
          {footerTypes.length > 0 && (
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Optionsprogram</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {footerTypes.map((kpi) => {
                  const c = findCell(data, kpi.id);
                  if (!c) return <div key={kpi.id} className="text-sm text-muted-foreground">{kpi.name}: —</div>;
                  return <KpiBlock key={kpi.id} kpi={kpi} cell={c} large />;
                })}
              </CardContent>
            </Card>
          )}

        </>
      )}
    </div>
  );
}

function sum(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

function KpiBlock({ kpi, cell, large }: { kpi: KpiType; cell: Cell; large?: boolean }) {
  const budgetLabel = kpi.budget_label ?? "Budget";
  const diffBudget = cell.actual !== null && cell.budget !== null ? cell.actual - cell.budget : null;
  const diffStretch = cell.actual !== null && cell.stretch !== null ? cell.actual - cell.stretch : null;
  const positive = diffBudget !== null && (kpi.higher_is_better ? diffBudget >= 0 : diffBudget <= 0);
  const Icon = diffBudget === null || Math.abs(diffBudget) < 0.005 ? Minus : positive ? TrendingUp : TrendingDown;
  const color = diffBudget === null ? "text-muted-foreground" : positive ? "text-accent" : "text-destructive";

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-muted-foreground leading-tight">{kpi.name}</span>
        {diffBudget !== null && (
          <Badge variant="outline" className={`gap-1 shrink-0 ${color} border-current/30`}>
            <Icon className="h-3 w-3" />
            {formatDiff(diffBudget, kpi)}
          </Badge>
        )}
      </div>
      <div className={large ? "text-2xl font-bold" : "text-lg font-bold"}>
        {formatKpiValue(cell.actual, kpi.format, kpi.unit)}
      </div>
      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
        {cell.budget !== null && (
          <div>
            {budgetLabel} {formatKpiValue(cell.budget, kpi.format, kpi.unit)}
          </div>
        )}
        {cell.stretch !== null && (
          <div>
            Stretch {formatKpiValue(cell.stretch, kpi.format, kpi.unit)}
            {diffStretch !== null && (
              <span className={kpi.higher_is_better ? (diffStretch >= 0 ? " text-accent" : " text-destructive") : (diffStretch <= 0 ? " text-accent" : " text-destructive")}>
                {" "}({formatDiff(diffStretch, kpi)})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
