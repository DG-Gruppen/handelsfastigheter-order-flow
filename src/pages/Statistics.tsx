import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { BarChart3, Users, Clock, TrendingUp, Eye, Monitor, Smartphone } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { sv } from "date-fns/locale";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--destructive))",
  "hsl(210, 70%, 55%)",
  "hsl(160, 60%, 45%)",
  "hsl(280, 60%, 55%)",
  "hsl(30, 80%, 55%)",
  "hsl(340, 70%, 55%)",
];

// Friendly names for routes
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
};

type PeriodKey = "7d" | "30d" | "90d";

export default function Statistics() {
  const [period, setPeriod] = useState<PeriodKey>("30d");

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const since = useMemo(() => startOfDay(subDays(new Date(), days)).toISOString(), [days]);

  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["page-analytics", since],
    queryFn: async () => {
      const { data } = await supabase
        .from("page_analytics")
        .select("page_path, module_slug, session_hash, duration_seconds, viewport_width, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // ─── Computed metrics ───
  const metrics = useMemo(() => {
    if (rawData.length === 0) return null;

    const totalViews = rawData.filter(r => r.duration_seconds === 0).length;
    const uniqueSessions = new Set(rawData.map(r => r.session_hash)).size;
    const durRecords = rawData.filter(r => r.duration_seconds > 0);
    const avgDuration = durRecords.length > 0
      ? Math.round(durRecords.reduce((s, r) => s + r.duration_seconds, 0) / durRecords.length)
      : 0;

    // Page views by path
    const pathCounts: Record<string, number> = {};
    const pathDurations: Record<string, number[]> = {};
    rawData.forEach(r => {
      const path = r.page_path;
      if (r.duration_seconds === 0) {
        pathCounts[path] = (pathCounts[path] || 0) + 1;
      }
      if (r.duration_seconds > 0) {
        if (!pathDurations[path]) pathDurations[path] = [];
        pathDurations[path].push(r.duration_seconds);
      }
    });

    const topPages = Object.entries(pathCounts)
      .map(([path, views]) => ({
        path,
        name: PAGE_NAMES[path] || path,
        views,
        avgDuration: pathDurations[path]
          ? Math.round(pathDurations[path].reduce((a, b) => a + b, 0) / pathDurations[path].length)
          : 0,
      }))
      .sort((a, b) => b.views - a.views);

    // Views over time (per day)
    const dailyMap: Record<string, { views: number; sessions: Set<string> }> = {};
    rawData.forEach(r => {
      if (r.duration_seconds !== 0) return;
      const day = r.created_at.slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { views: 0, sessions: new Set() };
      dailyMap[day].views++;
      dailyMap[day].sessions.add(r.session_hash);
    });

    const dailyTrend = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, d]) => ({
        date: format(new Date(day), "d MMM", { locale: sv }),
        rawDate: day,
        views: d.views,
        visitors: d.sessions.size,
      }));

    // Device breakdown
    const mobile = rawData.filter(r => r.viewport_width && r.viewport_width < 768).length;
    const tablet = rawData.filter(r => r.viewport_width && r.viewport_width >= 768 && r.viewport_width < 1024).length;
    const desktop = rawData.filter(r => r.viewport_width && r.viewport_width >= 1024).length;
    const total = mobile + tablet + desktop || 1;
    const devices = [
      { name: "Mobil", value: mobile, pct: Math.round((mobile / total) * 100) },
      { name: "Surfplatta", value: tablet, pct: Math.round((tablet / total) * 100) },
      { name: "Desktop", value: desktop, pct: Math.round((desktop / total) * 100) },
    ].filter(d => d.value > 0);

    return { totalViews, uniqueSessions, avgDuration, topPages, dailyTrend, devices };
  }, [rawData]);

  function formatDuration(sec: number) {
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${min}m ${s}s` : `${min}m`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Statistik
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Anonym besöksstatistik — inga personuppgifter lagras
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Senaste 7 dagar</SelectItem>
            <SelectItem value="30d">Senaste 30 dagar</SelectItem>
            <SelectItem value="90d">Senaste 90 dagar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !metrics || metrics.totalViews === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Ingen data ännu</p>
            <p className="text-sm mt-1">Statistik börjar samlas in automatiskt när användare besöker sidor.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <p className="text-2xl font-bold">{metrics.uniqueSessions.toLocaleString("sv")}</p>
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
                    <p className="text-xs text-muted-foreground">Snitt per sida</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{metrics.topPages.length}</p>
                    <p className="text-xs text-muted-foreground">Aktiva sidor</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Daily Trend */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Besök & unika besökare per dag</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.dailyTrend}>
                      <defs>
                        <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Area type="monotone" dataKey="views" name="Visningar" stroke="hsl(var(--primary))" fill="url(#viewsGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="visitors" name="Besökare" stroke="hsl(var(--accent))" fill="url(#visitorsGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Device Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Enheter</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.devices}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        dataKey="value"
                        nameKey="name"
                        paddingAngle={4}
                      >
                        {metrics.devices.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
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
              </CardContent>
            </Card>
          </div>

          {/* Top Pages Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Populäraste sidor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">#</th>
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Sida</th>
                      <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Visningar</th>
                      <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Snitt tid</th>
                      <th className="text-left py-2 font-medium text-muted-foreground min-w-[120px]">Andel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.topPages.slice(0, 15).map((page, i) => {
                      const pct = metrics.totalViews > 0 ? (page.views / metrics.totalViews) * 100 : 0;
                      return (
                        <tr key={page.path} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 pr-4 text-muted-foreground font-medium">{i + 1}</td>
                          <td className="py-2.5 pr-4">
                            <div>
                              <span className="font-medium">{page.name}</span>
                              <span className="text-muted-foreground text-xs ml-2">{page.path}</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 text-right font-medium">{page.views.toLocaleString("sv")}</td>
                          <td className="py-2.5 pr-4 text-right text-muted-foreground">{formatDuration(page.avgDuration)}</td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary/70"
                                  style={{ width: `${Math.max(pct, 2)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
