import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users, ShoppingCart, BookOpen, Video, FileText, FolderOpen,
  CheckCircle2, Clock, XCircle, Package, TrendingUp, Activity,
} from "lucide-react";

interface Stats {
  totalUsers: number;
  departments: number;
  ordersTotal: number;
  ordersPending: number;
  ordersApproved: number;
  ordersRejected: number;
  ordersDelivered: number;
  kbArticles: number;
  kbArticlesPublished: number;
  kbVideos: number;
  kbVideosPublished: number;
  documents: number;
  folders: number;
}

interface AdminDashboardProps {
  onNavigate: (section: string) => void;
}

export default function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [
        { count: totalUsers },
        { data: deptData },
        { data: ordersData },
        { count: kbArticles },
        { count: kbArticlesPublished },
        { count: kbVideos },
        { count: kbVideosPublished },
        { count: documents },
        { count: folders },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("department"),
        supabase.from("orders").select("status"),
        supabase.from("kb_articles").select("*", { count: "exact", head: true }),
        supabase.from("kb_articles").select("*", { count: "exact", head: true }).eq("is_published", true),
        supabase.from("kb_videos").select("*", { count: "exact", head: true }),
        supabase.from("kb_videos").select("*", { count: "exact", head: true }).eq("is_published", true),
        supabase.from("document_files").select("*", { count: "exact", head: true }),
        supabase.from("document_folders").select("*", { count: "exact", head: true }),
      ]);

      const depts = new Set((deptData ?? []).map((d: any) => d.department).filter(Boolean));
      const orders = ordersData ?? [];

      setStats({
        totalUsers: totalUsers ?? 0,
        departments: depts.size,
        ordersTotal: orders.length,
        ordersPending: orders.filter((o: any) => o.status === "pending").length,
        ordersApproved: orders.filter((o: any) => o.status === "approved").length,
        ordersRejected: orders.filter((o: any) => o.status === "rejected").length,
        ordersDelivered: orders.filter((o: any) => o.status === "delivered").length,
        kbArticles: kbArticles ?? 0,
        kbArticlesPublished: kbArticlesPublished ?? 0,
        kbVideos: kbVideos ?? 0,
        kbVideosPublished: kbVideosPublished ?? 0,
        documents: documents ?? 0,
        folders: folders ?? 0,
      });
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="h-8 w-8 text-muted-foreground/30 animate-pulse" />
      </div>
    );
  }

  const kpiCards = [
    {
      label: "Användare",
      value: stats.totalUsers,
      sub: `${stats.departments} avdelningar`,
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
      section: "users",
    },
    {
      label: "Beställningar",
      value: stats.ordersTotal,
      sub: `${stats.ordersPending} väntar`,
      icon: ShoppingCart,
      color: "text-warning",
      bg: "bg-warning/10",
      section: "categories",
    },
    {
      label: "Artiklar",
      value: stats.kbArticles,
      sub: `${stats.kbArticlesPublished} publicerade`,
      icon: BookOpen,
      color: "text-accent",
      bg: "bg-accent/10",
      section: "knowledge",
    },
    {
      label: "Videor",
      value: stats.kbVideos,
      sub: `${stats.kbVideosPublished} publicerade`,
      icon: Video,
      color: "text-destructive",
      bg: "bg-destructive/10",
      section: "knowledge",
    },
    {
      label: "Dokument",
      value: stats.documents,
      sub: `${stats.folders} mappar`,
      icon: FileText,
      color: "text-accent",
      bg: "bg-accent/10",
      section: null,
    },
  ];

  const orderBreakdown = [
    { label: "Väntar", value: stats.ordersPending, icon: Clock, color: "text-warning" },
    { label: "Godkända", value: stats.ordersApproved, icon: CheckCircle2, color: "text-accent" },
    { label: "Levererade", value: stats.ordersDelivered, icon: Package, color: "text-primary" },
    { label: "Avslagna", value: stats.ordersRejected, icon: XCircle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpiCards.map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => kpi.section && onNavigate(kpi.section)}
            className="text-left group"
            disabled={!kpi.section}
          >
            <Card className="glass-card h-full transition-all hover:shadow-md group-hover:border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.bg}`}>
                    <kpi.icon className={`h-4.5 w-4.5 ${kpi.color}`} />
                  </div>
                  {kpi.section && (
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors" />
                  )}
                </div>
                <p className="text-2xl font-bold text-foreground font-heading">{kpi.value}</p>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">{kpi.label}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">{kpi.sub}</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {/* Orders breakdown */}
      <Card className="glass-card">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-4.5 w-4.5 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">Beställningsstatus</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {orderBreakdown.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/30 p-3"
              >
                <item.icon className={`h-5 w-5 ${item.color} shrink-0`} />
                <div>
                  <p className="text-lg font-bold text-foreground">{item.value}</p>
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {stats.ordersTotal > 0 && (
            <div className="mt-4 flex h-2.5 rounded-full overflow-hidden bg-secondary">
              {stats.ordersDelivered > 0 && (
                <div
                  className="bg-primary transition-all rounded-l-full"
                  style={{ width: `${(stats.ordersDelivered / stats.ordersTotal) * 100}%` }}
                  title={`Levererade: ${stats.ordersDelivered}`}
                />
              )}
              {stats.ordersApproved > 0 && (
                <div
                  className="bg-accent transition-all"
                  style={{ width: `${(stats.ordersApproved / stats.ordersTotal) * 100}%` }}
                  title={`Godkända: ${stats.ordersApproved}`}
                />
              )}
              {stats.ordersPending > 0 && (
                <div
                  className="bg-warning transition-all"
                  style={{ width: `${(stats.ordersPending / stats.ordersTotal) * 100}%` }}
                  title={`Väntar: ${stats.ordersPending}`}
                />
              )}
              {stats.ordersRejected > 0 && (
                <div
                  className="bg-destructive transition-all"
                  style={{ width: `${(stats.ordersRejected / stats.ordersTotal) * 100}%` }}
                  title={`Avslagna: ${stats.ordersRejected}`}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KB overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button onClick={() => onNavigate("knowledge")} className="text-left group">
          <Card className="glass-card h-full transition-all hover:shadow-md group-hover:border-accent/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4.5 w-4.5 text-accent" />
                <h3 className="text-sm font-semibold text-foreground">Kunskapsbanken</h3>
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.kbArticlesPublished}</p>
                  <p className="text-[11px] text-muted-foreground">publicerade artiklar</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.kbArticles - stats.kbArticlesPublished}</p>
                  <p className="text-[11px] text-muted-foreground">utkast</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.kbVideosPublished}</p>
                  <p className="text-[11px] text-muted-foreground">publicerade videor</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </button>

        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <FolderOpen className="h-4.5 w-4.5 text-accent" />
              <h3 className="text-sm font-semibold text-foreground">Dokumentarkiv</h3>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.folders}</p>
                <p className="text-[11px] text-muted-foreground">mappar</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.documents}</p>
                <p className="text-[11px] text-muted-foreground">filer</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
