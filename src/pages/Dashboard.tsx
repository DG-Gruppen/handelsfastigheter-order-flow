import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus, Clock, CheckCircle2, XCircle, Package, Zap, LogOut, UserPlus,
  ClipboardList, ShieldCheck, TrendingUp, Banknote, Building2, Percent,
  ArrowUpRight, Award, PartyPopper, Cake,
} from "lucide-react";

import { kpis, okrs, recognitions, weeklyWin, jubilees, quickTools } from "@/data/dashboard";
import { newsPosts } from "@/data/news";

/* ── Order helpers ── */
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Väntar", variant: "secondary", icon: Clock },
  approved: { label: "Godkänd", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Avslagen", variant: "destructive", icon: XCircle },
  delivered: { label: "Levererad", variant: "outline", icon: Package },
};

interface Order {
  id: string;
  title: string;
  description: string;
  status: string;
  category: string;
  created_at: string;
  approved_at: string | null;
  requester_id: string;
  approver_id: string | null;
  order_reason: string | null;
  recipient_type: string | null;
}

function isAutoApproved(o: Order) { return o.status === "approved" && o.requester_id === o.approver_id; }

function getOrderTag(o: Order) {
  if (o.order_reason === "end_of_employment") return { label: "Offboarding", icon: LogOut, className: "bg-destructive/10 text-destructive border-destructive/20" };
  if (o.recipient_type === "new") return { label: "Nyanställning", icon: UserPlus, className: "bg-primary/10 text-primary border-primary/20" };
  return null;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "God morgon";
  if (h < 18) return "God eftermiddag";
  return "God kväll";
}

const KPI_ICONS = [TrendingUp, Banknote, Building2, Percent];

/* ── Component ── */
export default function Dashboard() {
  const { user, profile, roles } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager");

  useEffect(() => {
    if (!user || !profile) return;
    const fetchOrders = async () => {
      setLoading(true);
      if (isAdmin) {
        const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
        setOrders((data as Order[]) ?? []);
      } else if (isManager) {
        const { data: managed } = await supabase.from("profiles").select("user_id").eq("manager_id", profile.id);
        const ids = [user.id, ...(managed ?? []).map((p) => p.user_id)];
        const { data } = await supabase.from("orders").select("*").in("requester_id", ids).order("created_at", { ascending: false });
        setOrders((data as Order[]) ?? []);
      } else {
        const { data } = await supabase.from("orders").select("*").eq("requester_id", user.id).order("created_at", { ascending: false });
        setOrders((data as Order[]) ?? []);
      }
      setLoading(false);
    };
    fetchOrders();
  }, [user, profile, isAdmin, isManager]);

  const counts = {
    pending: orders.filter((o) => o.status === "pending").length,
    approved: orders.filter((o) => o.status === "approved").length,
    total: orders.length,
    needsMyApproval: orders.filter((o) => o.status === "pending" && o.approver_id === user?.id).length,
  };

  const firstName = profile?.full_name?.split(" ")[0] || "du";
  const latestNews = newsPosts.slice(0, 3);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* ── Greeting ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
            {getGreeting()}, {firstName} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Här är SHF:s nuläge — du gör skillnad varje dag.</p>
        </div>
        <Link to="/orders/new">
          <Button className="gap-2 w-full md:w-auto gradient-primary hover:opacity-90 shadow-md shadow-primary/20" size="lg">
            <Plus className="h-4 w-4" />
            Ny beställning
          </Button>
        </Link>
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
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recognitions.map((r, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{r.value === "Erfarenhet" ? "⭐" : r.value === "Driv" ? "🚀" : "🌱"}</span>
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">{r.from}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-medium">{r.to}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Order stats + list ── */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        {[
          { value: counts.total, label: "Totalt", colorClass: "text-primary", borderClass: "border-t-primary/30", bgClass: "bg-primary/[0.03]" },
          { value: counts.pending, label: "Väntar", colorClass: "text-warning", borderClass: "border-t-warning/30", bgClass: "bg-warning/[0.03]", extra: counts.needsMyApproval > 0 ? `${counts.needsMyApproval} att attestera` : null },
          { value: counts.approved, label: "Godkända", colorClass: "text-accent", borderClass: "border-t-accent/30", bgClass: "bg-accent/[0.03]" },
        ].map((stat, i) => (
          <Card key={stat.label} className={`glass-card border-t-2 ${stat.borderClass}`}>
            <CardContent className={`p-3 md:pt-6 md:p-6 ${stat.bgClass}`}>
              <div className={`text-2xl md:text-3xl font-heading font-bold ${stat.colorClass}`}>{stat.value}</div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{stat.label}</p>
              {"extra" in stat && stat.extra && (
                <p className="text-[10px] md:text-xs font-medium text-warning mt-1">
                  <ShieldCheck className="inline h-3 w-3 mr-0.5 -mt-0.5" />{stat.extra}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card border-t-2 border-t-primary/30">
        <CardHeader className="px-4 md:px-6">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Senaste beställningar
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Laddar...</p>
          ) : orders.length === 0 ? (
            <div className="text-center py-10 space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60">
                <Package className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">Inga beställningar ännu</p>
              <Link to="/orders/new">
                <Button variant="outline" className="gap-2" size="lg"><Plus className="h-4 w-4" />Skapa din första beställning</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/50 -mx-4 md:mx-0">
              {[...orders].sort((a, b) => {
                const aP = a.status === "pending" && a.approver_id === user?.id ? 1 : 0;
                const bP = b.status === "pending" && b.approver_id === user?.id ? 1 : 0;
                return bP - aP;
              }).slice(0, 5).map((order) => {
                const sc = statusConfig[order.status] ?? statusConfig.pending;
                const Icon = sc.icon;
                const tag = getOrderTag(order);
                const needsApproval = order.status === "pending" && order.approver_id === user?.id;
                return (
                  <Link key={order.id} to={`/orders/${order.id}`} className="flex items-start justify-between px-4 md:px-0 py-3.5 transition-colors group hover:bg-secondary/20 gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground truncate">{order.title}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("sv-SE")}</p>
                        {tag && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${tag.className}`}>
                            <tag.icon className="h-2.5 w-2.5" />{tag.label}
                          </span>
                        )}
                        {needsApproval && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-warning/10 text-warning border-warning/20">
                            <ShieldCheck className="h-2.5 w-2.5" />Attestera
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      {isAutoApproved(order) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded-md">
                          <Zap className="h-2.5 w-2.5" />Auto
                        </span>
                      )}
                      <Badge variant={sc.variant} className="gap-1 text-xs whitespace-nowrap">
                        <Icon className="h-3 w-3" />{sc.label}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
              {orders.length > 5 && (
                <div className="pt-3 text-center">
                  <Link to="/history" className="text-xs text-primary hover:underline font-medium">Visa alla {orders.length} beställningar →</Link>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                <button
                  key={tool.label}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <span className="text-xl">{tool.emoji}</span>
                  <span className="text-[10px] font-medium text-muted-foreground text-center">{tool.label}</span>
                </button>
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
