import { useState, useMemo, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";

const PageDetailView = lazy(() => import("@/components/statistics/PageDetailView"));
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line,
} from "recharts";
import {
  BarChart3, Users, Clock, TrendingUp, Eye, MessageCircle, Search,
  Flame, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
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

const WEEKDAY_LABELS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);

type PeriodKey = "7d" | "30d" | "90d";

function formatDuration(sec: number) {
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${min}m ${s}s` : `${min}m`;
}

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

export default function Statistics() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const since = useMemo(() => startOfDay(subDays(new Date(), days)).toISOString(), [days]);

  // ─── Data Queries ───
  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["page-analytics", since],
    queryFn: async () => {
      const { data } = await supabase
        .from("page_analytics")
        .select("page_path, module_slug, session_hash, duration_seconds, viewport_width, created_at, referrer_path")
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: chatStats } = useQuery({
    queryKey: ["chat-stats", since],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_anonymous_chat_stats", { _since: since });
      if (error) throw error;
      return data as {
        total_messages: number;
        active_channels: number;
        total_reactions: number;
        unique_chatters: number;
        thread_messages: number;
        messages_per_day: { day: string; count: number }[] | null;
        top_channels: { name: string; msg_count: number }[] | null;
      };
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: searchData = [] } = useQuery({
    queryKey: ["search-log", since],
    queryFn: async () => {
      const { data } = await supabase
        .from("search_log")
        .select("query_text, result_count, source, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: contentData } = useQuery({
    queryKey: ["content-engagement", since],
    queryFn: async () => {
      const [articles, news] = await Promise.all([
        supabase.from("kb_articles").select("title, views, slug").eq("is_published", true).order("views", { ascending: false }).limit(10),
        supabase.from("news").select("title, emoji").eq("is_published", true).order("created_at", { ascending: false }).limit(10),
      ]);
      return {
        topArticles: articles.data ?? [],
        recentNews: news.data ?? [],
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // ─── Computed Metrics ───
  const metrics = useMemo(() => {
    if (rawData.length === 0) return null;

    const totalViews = rawData.filter(r => r.duration_seconds === 0).length;
    const uniqueSessions = new Set(rawData.map(r => r.session_hash)).size;
    const durRecords = rawData.filter(r => (r.duration_seconds ?? 0) > 0);
    const avgDuration = durRecords.length > 0
      ? Math.round(durRecords.reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / durRecords.length)
      : 0;

    // Page views by path
    const pathCounts: Record<string, number> = {};
    const pathDurations: Record<string, number[]> = {};
    rawData.forEach(r => {
      const path = r.page_path;
      if (r.duration_seconds === 0) {
        pathCounts[path] = (pathCounts[path] || 0) + 1;
      }
      if ((r.duration_seconds ?? 0) > 0) {
        if (!pathDurations[path]) pathDurations[path] = [];
        pathDurations[path].push(r.duration_seconds ?? 0);
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

    // Daily trend
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

    // ─── Heatmap (weekday x hour) ───
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    rawData.forEach(r => {
      if (r.duration_seconds !== 0) return;
      const d = new Date(r.created_at);
      const weekday = (d.getDay() + 6) % 7; // Mon=0
      const hour = d.getHours();
      heatmap[weekday][hour]++;
    });

    // ─── Module engagement ranking ───
    const moduleMap: Record<string, { views: number; totalDur: number; durCount: number }> = {};
    rawData.forEach(r => {
      const slug = r.module_slug;
      if (!slug) return;
      if (!moduleMap[slug]) moduleMap[slug] = { views: 0, totalDur: 0, durCount: 0 };
      if (r.duration_seconds === 0) moduleMap[slug].views++;
      if ((r.duration_seconds ?? 0) > 0) {
        moduleMap[slug].totalDur += r.duration_seconds ?? 0;
        moduleMap[slug].durCount++;
      }
    });
    const moduleRanking = Object.entries(moduleMap)
      .map(([slug, d]) => ({
        slug,
        name: Object.entries(PAGE_NAMES).find(([, n]) =>
          n.toLowerCase().includes(slug.replace(/-/g, " ").toLowerCase())
        )?.[1] || slug,
        views: d.views,
        avgDuration: d.durCount > 0 ? Math.round(d.totalDur / d.durCount) : 0,
        engagement: d.views + (d.durCount > 0 ? Math.round(d.totalDur / d.durCount) * 0.5 : 0),
      }))
      .sort((a, b) => b.engagement - a.engagement);

    // ─── Module trends (daily views per module for top 5) ───
    const top5Slugs = moduleRanking.slice(0, 5).map(m => m.slug);
    const moduleTrendMap: Record<string, Record<string, number>> = {};
    rawData.forEach(r => {
      if (r.duration_seconds !== 0 || !r.module_slug || !top5Slugs.includes(r.module_slug)) return;
      const day = r.created_at.slice(0, 10);
      if (!moduleTrendMap[day]) moduleTrendMap[day] = {};
      moduleTrendMap[day][r.module_slug] = (moduleTrendMap[day][r.module_slug] || 0) + 1;
    });
    const moduleTrend = Object.entries(moduleTrendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, slugs]) => ({
        date: format(new Date(day), "d MMM", { locale: sv }),
        ...slugs,
      }));

    return { totalViews, uniqueSessions, avgDuration, topPages, dailyTrend, devices, heatmap, moduleRanking, moduleTrend, top5Slugs };
  }, [rawData]);

  // ─── Search analytics ───
  const searchMetrics = useMemo(() => {
    if (searchData.length === 0) return null;
    const queryCounts: Record<string, number> = {};
    let zeroResults = 0;
    searchData.forEach(s => {
      const q = s.query_text.toLowerCase().trim();
      queryCounts[q] = (queryCounts[q] || 0) + 1;
      if (s.result_count === 0) zeroResults++;
    });
    const topQueries = Object.entries(queryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([query, count]) => ({ query, count }));

    return {
      totalSearches: searchData.length,
      zeroResults,
      zeroRate: Math.round((zeroResults / searchData.length) * 100),
      topQueries,
    };
  }, [searchData]);

  const heatmapMax = metrics ? Math.max(...metrics.heatmap.flat(), 1) : 1;

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

      {/* Detail view for a specific page */}
      {selectedPage ? (
        <Suspense fallback={<div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
          <PageDetailView
            pagePath={selectedPage}
            rawData={rawData}
            onBack={() => setSelectedPage(null)}
            onNavigate={(path) => setSelectedPage(path)}
          />
        </Suspense>
      ) : isLoading ? (
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
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-1.5"><Eye className="h-3.5 w-3.5" />Översikt</TabsTrigger>
            <TabsTrigger value="modules" className="gap-1.5"><Flame className="h-3.5 w-3.5" />Moduler</TabsTrigger>
            <TabsTrigger value="chat" className="gap-1.5"><MessageCircle className="h-3.5 w-3.5" />Chatt</TabsTrigger>
            <TabsTrigger value="content" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Innehåll & Sök</TabsTrigger>
          </TabsList>

          {/* ═══════════ OVERVIEW TAB ═══════════ */}
          <TabsContent value="overview" className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={Eye} label="Sidvisningar" value={metrics.totalViews} color="primary" />
              <KpiCard icon={Users} label="Unika besökare" value={metrics.uniqueSessions} color="accent" />
              <KpiCard icon={Clock} label="Snitt per sida" value={formatDuration(metrics.avgDuration)} color="destructive" />
              <KpiCard icon={TrendingUp} label="Aktiva sidor" value={metrics.topPages.length} color="primary" />
            </div>

            {/* Charts Row */}
            <div className="grid lg:grid-cols-3 gap-4">
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
                        <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Area type="monotone" dataKey="views" name="Visningar" stroke="hsl(var(--primary))" fill="url(#viewsGrad)" strokeWidth={2} />
                        <Area type="monotone" dataKey="visitors" name="Besökare" stroke="hsl(var(--accent))" fill="url(#visitorsGrad)" strokeWidth={2} />
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
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={metrics.devices} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={4}>
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
                </CardContent>
              </Card>
            </div>

            {/* Heatmap */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Aktivitet per veckodag & timme</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="min-w-[600px]">
                    <div className="flex gap-0.5 mb-1 pl-12">
                      {HOUR_LABELS.filter((_, i) => i % 3 === 0).map(h => (
                        <span key={h} className="text-[10px] text-muted-foreground" style={{ width: `${(3 / 24) * 100}%` }}>{h}</span>
                      ))}
                    </div>
                    {metrics.heatmap.map((row, wi) => (
                      <div key={wi} className="flex items-center gap-0.5 mb-0.5">
                        <span className="text-[11px] text-muted-foreground w-10 text-right pr-2 shrink-0">{WEEKDAY_LABELS[wi]}</span>
                        {row.map((val, hi) => {
                          const intensity = val / heatmapMax;
                          return (
                            <div
                              key={hi}
                              className="flex-1 h-5 rounded-sm transition-colors"
                              style={{
                                backgroundColor: val === 0
                                  ? "hsl(var(--muted))"
                                  : `hsl(var(--primary) / ${0.15 + intensity * 0.85})`,
                              }}
                              title={`${WEEKDAY_LABELS[wi]} ${HOUR_LABELS[hi]}: ${val} visningar`}
                            />
                          );
                        })}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-3 justify-end">
                      <span className="text-[10px] text-muted-foreground">Låg</span>
                      <div className="flex gap-0.5">
                        {[0.15, 0.35, 0.55, 0.75, 1].map((op, i) => (
                          <div key={i} className="w-4 h-3 rounded-sm" style={{ backgroundColor: `hsl(var(--primary) / ${op})` }} />
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground">Hög</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Pages */}
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
                              <span className="font-medium">{page.name}</span>
                              <span className="text-muted-foreground text-xs ml-2">{page.path}</span>
                            </td>
                            <td className="py-2.5 pr-4 text-right font-medium">{page.views.toLocaleString("sv")}</td>
                            <td className="py-2.5 pr-4 text-right text-muted-foreground">{formatDuration(page.avgDuration)}</td>
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(pct, 2)}%` }} />
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
          </TabsContent>

          {/* ═══════════ MODULES TAB ═══════════ */}
          <TabsContent value="modules" className="space-y-4">
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Module Ranking */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Modul-ranking (engagemang)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {metrics.moduleRanking.slice(0, 12).map((m, i) => {
                      const maxEng = metrics.moduleRanking[0]?.engagement || 1;
                      const pct = (m.engagement / maxEng) * 100;
                      return (
                        <div key={m.slug} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-5 text-right font-medium">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-sm font-medium truncate">{m.name}</span>
                              <span className="text-xs text-muted-foreground ml-2 shrink-0">
                                {m.views} visn · {formatDuration(m.avgDuration)} snitt
                              </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(pct, 3)}%`,
                                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Module Trend */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Trender — topp 5 moduler</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metrics.moduleTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        {metrics.top5Slugs.map((slug, i) => (
                          <Line
                            key={slug}
                            type="monotone"
                            dataKey={slug}
                            name={PAGE_NAMES[Object.keys(PAGE_NAMES).find(k => PAGE_NAMES[k].toLowerCase().includes(slug.replace(/-/g, " ").toLowerCase())) || ""] || slug}
                            stroke={CHART_COLORS[i]}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══════════ CHAT TAB ═══════════ */}
          <TabsContent value="chat" className="space-y-4">
            {chatStats ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <KpiCard icon={MessageCircle} label="Meddelanden" value={chatStats.total_messages} color="primary" />
                  <KpiCard icon={Users} label="Aktiva chattare" value={chatStats.unique_chatters} color="accent" />
                  <KpiCard icon={Flame} label="Aktiva kanaler" value={chatStats.active_channels} color="destructive" />
                  <KpiCard icon={MessageCircle} label="Trådmeddelanden" value={chatStats.thread_messages} color="primary" />
                  <KpiCard icon={TrendingUp} label="Reaktioner" value={chatStats.total_reactions} color="accent" />
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                  {/* Messages per day */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Meddelanden per dag</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        {chatStats.messages_per_day && chatStats.messages_per_day.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chatStats.messages_per_day.map(d => ({
                              date: format(new Date(d.day), "d MMM", { locale: sv }),
                              count: d.count,
                            }))}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                              <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                              <Tooltip contentStyle={tooltipStyle} />
                              <Bar dataKey="count" name="Meddelanden" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Ingen chattdata för perioden</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top channels */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Mest aktiva kanaler</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {chatStats.top_channels && chatStats.top_channels.length > 0 ? (
                        <div className="space-y-2">
                          {chatStats.top_channels.map((ch, i) => {
                            const maxCount = chatStats.top_channels![0]?.msg_count || 1;
                            return (
                              <div key={i} className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between mb-0.5">
                                    <span className="text-sm font-medium truncate">{ch.name}</span>
                                    <span className="text-xs text-muted-foreground">{ch.msg_count} meddelanden</span>
                                  </div>
                                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-accent/70" style={{ width: `${(ch.msg_count / maxCount) * 100}%` }} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">Ingen chattdata för perioden</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Chattstatistik kräver admin- eller IT-behörighet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════ CONTENT & SEARCH TAB ═══════════ */}
          <TabsContent value="content" className="space-y-4">
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Top Articles */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Mest lästa artiklar</CardTitle>
                </CardHeader>
                <CardContent>
                  {contentData?.topArticles && contentData.topArticles.length > 0 ? (
                    <div className="space-y-2">
                      {contentData.topArticles.map((a, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                            <span className="text-sm truncate">{a.title}</span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">{a.views} visn.</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Inga publicerade artiklar</p>
                  )}
                </CardContent>
              </Card>

              {/* Search Analytics */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Sökanalys
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {searchMetrics ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <p className="text-xl font-bold">{searchMetrics.totalSearches}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Sökningar</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold">{searchMetrics.zeroResults}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Utan resultat</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold">{searchMetrics.zeroRate}%</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Missfrekvens</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Vanligaste sökfrågorna</p>
                        <div className="space-y-1">
                          {searchMetrics.topQueries.map((q, i) => (
                            <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                              <span className="truncate">{q.query}</span>
                              <span className="text-xs text-muted-foreground shrink-0 ml-2">{q.count}×</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Ingen sökdata har samlats in ännu</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ─── Helper Components ───
function KpiCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg bg-${color}/10 flex items-center justify-center`}>
            <Icon className={`h-5 w-5 text-${color}`} />
          </div>
          <div>
            <p className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString("sv") : value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
