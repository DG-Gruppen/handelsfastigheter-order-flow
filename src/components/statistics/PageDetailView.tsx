import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { ChevronLeft, Eye, Clock, Users, ArrowRight, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--destructive))",
  "hsl(210, 70%, 55%)",
  "hsl(160, 60%, 45%)",
  "hsl(280, 60%, 55%)",
];

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

const PAGE_NAMES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/orders/new": "Ny beställning",
  "/history": "Historik",
  "/org": "Organisation",
  "/admin": "Admin",
  "/it-info": "IT-support",
  "/personal": "Personal",
  "/dokument": "Dokument",
  "/kunskapsbanken": "Kunskapsbanken",
  "/mitt-shf": "Mitt SHF",
  "/planner": "Planner",
  "/verktyg": "Verktyg",
  "/losenord": "Lösenord",
  "/kulturen": "Kulturen",
  "/nyheter": "Nyheter",
  "/arbetsklader": "Arbetskläder",
  "/statistik": "Statistik",
  "/profile": "Profil",
  "/onboarding": "Onboarding",
  "/chatt": "Chatt",
};

function formatDuration(sec: number) {
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${min}m ${s}s` : `${min}m`;
}

interface PageDetailViewProps {
  pagePath: string;
  rawData: {
    page_path: string;
    module_slug: string | null;
    session_hash: string;
    duration_seconds: number | null;
    viewport_width: number | null;
    created_at: string;
    referrer_path: string | null;
  }[];
  onBack: () => void;
  onNavigate: (path: string) => void;
}

export default function PageDetailView({ pagePath, rawData, onBack, onNavigate }: PageDetailViewProps) {
  const pageName = PAGE_NAMES[pagePath] || pagePath;

  // Filter data for this page
  const pageData = useMemo(() => rawData.filter(r => r.page_path === pagePath), [rawData, pagePath]);

  const metrics = useMemo(() => {
    const views = pageData.filter(r => r.duration_seconds === 0);
    const durations = pageData.filter(r => (r.duration_seconds ?? 0) > 0);
    const totalViews = views.length;
    const uniqueVisitors = new Set(views.map(r => r.session_hash)).size;
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / durations.length)
      : 0;

    // ─── Daily trend ───
    const dailyMap: Record<string, { views: number; sessions: Set<string>; totalDur: number; durCount: number }> = {};
    pageData.forEach(r => {
      const day = r.created_at.slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { views: 0, sessions: new Set(), totalDur: 0, durCount: 0 };
      if (r.duration_seconds === 0) {
        dailyMap[day].views++;
        dailyMap[day].sessions.add(r.session_hash);
      }
      if ((r.duration_seconds ?? 0) > 0) {
        dailyMap[day].totalDur += r.duration_seconds ?? 0;
        dailyMap[day].durCount++;
      }
    });
    const dailyTrend = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, d]) => ({
        date: format(new Date(day), "d MMM", { locale: sv }),
        views: d.views,
        visitors: d.sessions.size,
        avgDuration: d.durCount > 0 ? Math.round(d.totalDur / d.durCount) : 0,
      }));

    // ─── Device breakdown ───
    const mobile = pageData.filter(r => r.viewport_width && r.viewport_width < 768).length;
    const tablet = pageData.filter(r => r.viewport_width && r.viewport_width >= 768 && r.viewport_width < 1024).length;
    const desktop = pageData.filter(r => r.viewport_width && r.viewport_width >= 1024).length;
    const total = mobile + tablet + desktop || 1;
    const devices = [
      { name: "Mobil", value: mobile, pct: Math.round((mobile / total) * 100) },
      { name: "Surfplatta", value: tablet, pct: Math.round((tablet / total) * 100) },
      { name: "Desktop", value: desktop, pct: Math.round((desktop / total) * 100) },
    ].filter(d => d.value > 0);

    // ─── Hourly distribution ───
    const hourCounts = Array(24).fill(0);
    pageData.forEach(r => {
      if (r.duration_seconds !== 0) return;
      const hour = new Date(r.created_at).getHours();
      hourCounts[hour]++;
    });
    const hourlyData = hourCounts.map((count, i) => ({
      hour: HOUR_LABELS[i],
      count,
    }));

    // ─── Entry analysis (where users came from) ───
    const refCounts: Record<string, number> = {};
    pageData.forEach(r => {
      if (r.duration_seconds !== 0) return;
      const ref = r.referrer_path || "(direkt)";
      refCounts[ref] = (refCounts[ref] || 0) + 1;
    });
    const entryFrom = Object.entries(refCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([path, count]) => ({
        path,
        name: path === "(direkt)" ? "Direkt / Första sidan" : (PAGE_NAMES[path] || path),
        count,
        isNavigable: path !== "(direkt)" && path !== pagePath,
      }));

    // ─── Exit analysis (where users went next) ───
    // Find entries where this page's view is followed by another page view
    const exitCounts: Record<string, number> = {};
    const allViews = rawData
      .filter(r => r.duration_seconds === 0)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    for (let i = 0; i < allViews.length - 1; i++) {
      if (allViews[i].page_path === pagePath && allViews[i + 1].session_hash === allViews[i].session_hash) {
        const nextPath = allViews[i + 1].page_path;
        if (nextPath !== pagePath) {
          exitCounts[nextPath] = (exitCounts[nextPath] || 0) + 1;
        }
      }
    }
    const exitTo = Object.entries(exitCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([path, count]) => ({
        path,
        name: PAGE_NAMES[path] || path,
        count,
      }));

    return { totalViews, uniqueVisitors, avgDuration, dailyTrend, devices, hourlyData, entryFrom, exitTo };
  }, [pageData, rawData, pagePath]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
          <ChevronLeft className="h-4 w-4" />
          Tillbaka
        </Button>
        <div className="h-4 w-px bg-border" />
        <div>
          <h2 className="text-lg font-bold">{pageName}</h2>
          <p className="text-xs text-muted-foreground">{pagePath}</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.totalViews.toLocaleString("sv")}</p>
                <p className="text-xs text-muted-foreground">Sidvisningar</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.uniqueVisitors.toLocaleString("sv")}</p>
                <p className="text-xs text-muted-foreground">Unika besökare</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(metrics.avgDuration)}</p>
                <p className="text-xs text-muted-foreground">Snitt per besök</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily trend + Devices */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Besök & tid per dag</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.dailyTrend}>
                  <defs>
                    <linearGradient id="detailViewsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area yAxisId="left" type="monotone" dataKey="views" name="Visningar" stroke="hsl(var(--primary))" fill="url(#detailViewsGrad)" strokeWidth={2} />
                  <Area yAxisId="right" type="monotone" dataKey="avgDuration" name="Snitt tid (s)" stroke="hsl(var(--accent))" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Enheter</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.devices.length > 0 ? (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={metrics.devices} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={4}>
                        {metrics.devices.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-1">
                  {metrics.devices.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-medium">{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Ingen enhetsdata</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hourly activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Aktivitet per timme</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.hourlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} interval={2} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Visningar" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Entry / Exit */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-accent" />
              Besökare kom från
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.entryFrom.length > 0 ? (
              <div className="space-y-1">
                {metrics.entryFrom.map((e, i) => (
                  <button
                    key={i}
                    onClick={() => e.isNavigable ? onNavigate(e.path) : undefined}
                    disabled={!e.isNavigable}
                    className={`w-full flex items-center justify-between py-2 px-2 rounded-lg text-sm transition-colors ${
                      e.isNavigable ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ArrowLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{e.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{e.count} besök</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Ingen referrer-data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              Besökare gick vidare till
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.exitTo.length > 0 ? (
              <div className="space-y-1">
                {metrics.exitTo.map((e, i) => (
                  <button
                    key={i}
                    onClick={() => onNavigate(e.path)}
                    className="w-full flex items-center justify-between py-2 px-2 rounded-lg text-sm hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{e.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{e.count} besök</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Ingen exit-data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
