import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Clock, CheckCircle2, XCircle, Package, Zap, LogOut, UserPlus, ClipboardList, ShieldCheck } from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Väntar på attestering", variant: "secondary", icon: Clock },
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

function isAutoApproved(order: Order): boolean {
  return order.status === "approved" && order.requester_id === order.approver_id;
}

function getOrderTag(order: Order): { label: string; icon: any; className: string } | null {
  if (order.order_reason === "end_of_employment") {
    return { label: "Offboarding", icon: LogOut, className: "bg-destructive/10 text-destructive border-destructive/20" };
  }
  if (order.recipient_type === "new") {
    return { label: "Nyanställning", icon: UserPlus, className: "bg-primary/10 text-primary border-primary/20" };
  }
  return null;
}

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
        // Admins see all orders
        const { data } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });
        setOrders((data as Order[]) ?? []);
      } else if (isManager) {
        // Managers see own + their employees' orders
        const { data: managedProfiles } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("manager_id", profile.id);
        const employeeIds = (managedProfiles ?? []).map(p => p.user_id);
        const allIds = [user.id, ...employeeIds];

        const { data } = await supabase
          .from("orders")
          .select("*")
          .in("requester_id", allIds)
          .order("created_at", { ascending: false });
        setOrders((data as Order[]) ?? []);
      } else {
        // Employees see only own orders
        const { data } = await supabase
          .from("orders")
          .select("*")
          .eq("requester_id", user.id)
          .order("created_at", { ascending: false });
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
  };

  const firstName = profile?.full_name?.split(" ")[0] || "du";

  return (
    <div className="space-y-5 md:space-y-8">
      <div className="space-y-5 md:space-y-8">
        {/* Header */}
        <div className="space-y-3 md:space-y-0 md:flex md:items-center md:justify-between">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">
              Hej, {firstName} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Överblick av dina IT-beställningar
            </p>
          </div>
          <Link to="/orders/new" className="block">
            <Button className="gap-2 w-full md:w-auto gradient-primary hover:opacity-90 shadow-md shadow-primary/20" size="lg">
              <Plus className="h-4 w-4" />
              Ny beställning
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          {[
            { value: counts.total, label: "Totalt", colorClass: "text-primary", borderClass: "border-t-primary/30", bgClass: "bg-primary/[0.03]" },
            { value: counts.pending, label: "Väntar", colorClass: "text-warning", borderClass: "border-t-warning/30", bgClass: "bg-warning/[0.03]" },
            { value: counts.approved, label: "Godkända", colorClass: "text-accent", borderClass: "border-t-accent/30", bgClass: "bg-accent/[0.03]" },
          ].map((stat, i) => (
            <Card key={stat.label} className={`glass-card animate-fade-up border-t-2 ${stat.borderClass}`} style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}>
              <CardContent className={`p-3 md:pt-6 md:p-6 ${stat.bgClass}`}>
                <div className={`text-2xl md:text-3xl font-heading font-bold ${stat.colorClass}`}>
                  {stat.value}
                </div>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order list */}
        <Card className="glass-card border-t-2 border-t-primary/30">
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="font-heading text-base md:text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Beställningar
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            {loading ? (
              <p className="text-muted-foreground py-8 text-center">Laddar...</p>
            ) : orders.length === 0 ? (
              <div className="text-center py-10 md:py-12 space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60">
                  <Package className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">Inga beställningar ännu</p>
                <Link to="/orders/new">
                  <Button variant="outline" className="gap-2" size="lg">
                    <Plus className="h-4 w-4" />
                    Skapa din första beställning
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/50 -mx-4 md:mx-0">
                {orders.map((order) => {
                  const sc = statusConfig[order.status] ?? statusConfig.pending;
                  const Icon = sc.icon;
                  const autoApproved = isAutoApproved(order);
                  const tag = getOrderTag(order);
                  const needsMyApproval = order.status === "pending" && order.approver_id === user?.id;
                  return (
                    <Link
                      key={order.id}
                      to={`/orders/${order.id}`}
                      className="flex items-start justify-between px-4 md:px-0 py-3.5 md:py-4 active:bg-secondary/30 transition-colors group hover:bg-secondary/20 gap-2"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="font-medium text-sm md:text-base text-foreground truncate">
                          {order.title}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString("sv-SE")}
                          </p>
                          {tag && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${tag.className}`}>
                              <tag.icon className="h-2.5 w-2.5" />
                              {tag.label}
                            </span>
                          )}
                          {needsMyApproval && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-warning/10 text-warning border-warning/20">
                              <ShieldCheck className="h-2.5 w-2.5" />
                              Attestera
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        {autoApproved && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded-md">
                            <Zap className="h-2.5 w-2.5" />
                            Auto
                          </span>
                        )}
                        <Badge variant={sc.variant} className="gap-1 text-xs whitespace-nowrap">
                          <Icon className="h-3 w-3" />
                          <span className="hidden sm:inline">{sc.label}</span>
                          <span className="sm:hidden">
                            {order.status === "pending" ? "Väntar" : order.status === "approved" ? "Godkänd" : order.status === "rejected" ? "Avslagen" : sc.label}
                          </span>
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
