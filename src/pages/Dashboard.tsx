import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp, Banknote, Building2, Percent,
  ArrowUpRight, Award, PartyPopper, Cake,
} from "lucide-react";

import { kpis, okrs, weeklyWin, jubilees } from "@/data/dashboard";
import RecognitionDialog from "@/components/RecognitionDialog";
import HomepageSuggestion from "@/components/HomepageSuggestion";
import { newsPosts } from "@/data/news";

const KPI_ICONS = [TrendingUp, Banknote, Building2, Percent];

/* ── Component ── */
export default function Dashboard() {
  const { user, profile } = useAuth();
  const [recognitions, setRecognitions] = useState<any[]>([]);

  const fetchRecognitions = useCallback(async () => {
    const { data } = await supabase
      .from("recognitions")
      .select("id, icon, message, created_at, from_user_id, to_user_id")
      .order("created_at", { ascending: false })
      .limit(3);
    if (!data) return;
    const userIds = [...new Set(data.flatMap((r: any) => [r.from_user_id, r.to_user_id]))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);
    const nameMap: Record<string, string> = {};
    for (const p of (profiles ?? []) as any[]) nameMap[p.user_id] = p.full_name;
    setRecognitions(data.map((r: any) => ({
      ...r,
      from_name: nameMap[r.from_user_id] || "Okänd",
      to_name: nameMap[r.to_user_id] || "Okänd",
    })));
  }, []);

  const [quickTools, setQuickTools] = useState<{ id: string; name: string; emoji: string; url: string }[]>([]);

  useEffect(() => {
    if (!user || !profile) return;
    fetchRecognitions();
    supabase.from("tools" as any).select("id, name, emoji, url").eq("is_active", true).eq("is_starred", true).order("sort_order").then(({ data }) => {
      setQuickTools((data as any[]) ?? []);
    });
  }, [user, profile, fetchRecognitions]);

  function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return "God morgon";
    if (h < 18) return "God eftermiddag";
    return "God kväll";
  }

  const firstName = profile?.full_name?.split(" ")[0] || "du";
  const latestNews = newsPosts.slice(0, 3);

  return (
    <div className="space-y-6 md:space-y-8">
      <HomepageSuggestion />
      {/* ── Greeting ── */}
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
          {getGreeting()}, {firstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Här är SHF:s nuläge — du gör skillnad varje dag.</p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {kpis.map((kpi, i) => {
          const Icon = KPI_ICONS[i];
          return (
            <Card key={kpi.label} className="glass-card border-t-2 border-t-primary/20">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{kpi.label}</span>
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="text-xl md:text-2xl font-heading font-bold text-foreground">{kpi.value}</div>
                <div className="flex items-center gap-1 mt-1 text-xs text-primary font-medium">
                  <ArrowUpRight className="w-3 h-3" />
                  {kpi.change}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── OKR Snapshot ── */}
      <Card className="glass-card">
        <CardHeader className="pb-2 px-4 md:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-base">OKR-snapshot</CardTitle>
            <Link to="/strategy" className="text-xs text-primary hover:underline font-medium">Visa alla →</Link>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6 space-y-4">
          {okrs.map((okr) => (
            <div key={okr.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">{okr.emoji} {okr.label}</span>
                <span className="text-sm font-bold text-foreground">{okr.progress}%</span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${okr.progress}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        {/* ── Veckans vinst ── */}
        <Card className="glass-card border-l-4 border-l-accent">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Award className="w-5 h-5 text-accent" />
              Veckans vinst
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{weeklyWin.text}</p>
            <p className="text-xs font-medium text-accent mt-3">Publicerad av {weeklyWin.author} · {weeklyWin.week}</p>
          </CardContent>
        </Card>

        {/* ── Erkännanden ── */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <PartyPopper className="w-5 h-5 text-primary" />
              Senaste erkännanden
              <span className="ml-auto">
                <RecognitionDialog onCreated={fetchRecognitions} />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recognitions.length === 0 && (
              <p className="text-sm text-muted-foreground">Inga erkännanden ännu. Var först med att uppmärksamma en kollega!</p>
            )}
            {recognitions.map((r) => (
              <div key={r.id} className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{r.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">{r.from_name}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-medium">{r.to_name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>


      {/* ── Nyheter ── */}
      <Card className="glass-card">
        <CardHeader className="pb-2 px-4 md:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-base">Senaste nyheter</CardTitle>
            <Link to="/news" className="text-xs text-primary hover:underline font-medium">Alla nyheter →</Link>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6 space-y-4">
          {latestNews.map((news) => (
            <div key={news.id} className={`flex gap-4 pb-4 border-b border-border last:border-0 last:pb-0 ${news.isPinned ? "pl-3 border-l-2 border-l-accent" : ""}`}>
              <span className="text-2xl shrink-0">{news.emoji}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{news.category}</span>
                  {news.isPinned && <span className="text-[10px] uppercase tracking-wider font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">📌 Pinnad</span>}
                  <span className="text-[10px] text-muted-foreground">{news.publishedAt}</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground line-clamp-1">{news.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{news.body}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        {/* ── Jubilarer ── */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Cake className="w-5 h-5 text-accent" />
              Veckans jubilarer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {jubilees.map((j, i) => (
                <div key={i} className="flex items-center gap-3 bg-accent/10 rounded-lg px-4 py-3">
                  <span className="text-2xl">{j.emoji}</span>
                  <div>
                    <div className="text-sm font-medium">{j.name}</div>
                    <div className="text-xs text-muted-foreground">{j.event}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Snabbåtkomst ── */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base">Snabbåtkomst</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {quickTools.map((tool) => (
                <a
                  key={tool.id}
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <span className="text-xl">{tool.emoji}</span>
                  <span className="text-[10px] font-medium text-muted-foreground text-center">{tool.name}</span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Manifesto ── */}
      <div className="bg-[hsl(var(--sidebar-background))] rounded-lg p-8 text-center">
        <p className="font-heading text-xl md:text-2xl font-semibold text-sidebar-foreground italic mb-3">
          "Handel föder handel"
        </p>
        <p className="text-sm text-sidebar-foreground/70 max-w-2xl mx-auto leading-relaxed">
          Vi skapar levande handelsmiljöer som stärker lokalsamhällen och ger hyresgästerna
          de bästa förutsättningarna att lyckas. Ägare: AP4 och Kåpan Pensioner.
        </p>
      </div>
    </div>
  );
}
