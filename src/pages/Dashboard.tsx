import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Clock, CheckCircle2, XCircle, Package, ArrowRight } from "lucide-react";

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
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false });
      setOrders((data as Order[]) ?? []);
      setLoading(false);
    };
    fetchOrders();
  }, [user]);

  const counts = {
    pending: orders.filter((o) => o.status === "pending").length,
    approved: orders.filter((o) => o.status === "approved").length,
    total: orders.length,
  };

  const firstName = profile?.full_name?.split(" ")[0] || "du";

  return (
    <AppLayout>
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
            { value: counts.total, label: "Totalt", colorClass: "text-foreground" },
            { value: counts.pending, label: "Väntar", colorClass: "text-warning" },
            { value: counts.approved, label: "Godkända", colorClass: "text-success" },
          ].map((stat, i) => (
            <Card key={stat.label} className="glass-card animate-fade-up" style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}>
              <CardContent className="p-3 md:pt-6 md:p-6">
                <div className={`text-2xl md:text-3xl font-heading font-bold ${stat.colorClass}`}>
                  {stat.value}
                </div>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order list */}
        <Card className="glass-card">
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="font-heading text-base md:text-lg">Beställningar</CardTitle>
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
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between px-4 md:px-0 py-3.5 md:py-4 active:bg-secondary/30 transition-colors group"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1 mr-3">
                        <p className="font-medium text-sm md:text-base text-foreground truncate">
                          {order.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("sv-SE")}
                        </p>
                      </div>
                      <Badge variant={sc.variant} className="gap-1 text-xs shrink-0">
                        <Icon className="h-3 w-3" />
                        {sc.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
