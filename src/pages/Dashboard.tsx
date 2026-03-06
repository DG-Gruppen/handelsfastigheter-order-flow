import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Clock, CheckCircle2, XCircle, Package } from "lucide-react";

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
  const { user } = useAuth();
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

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Mina beställningar</h1>
            <p className="text-muted-foreground mt-1">Överblick av dina IT-beställningar</p>
          </div>
          <Link to="/orders/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Ny beställning
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="text-3xl font-heading font-bold text-foreground">{counts.total}</div>
              <p className="text-sm text-muted-foreground mt-1">Totalt</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="text-3xl font-heading font-bold text-warning">{counts.pending}</div>
              <p className="text-sm text-muted-foreground mt-1">Väntar på godkännande</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="text-3xl font-heading font-bold text-success">{counts.approved}</div>
              <p className="text-sm text-muted-foreground mt-1">Godkända</p>
            </CardContent>
          </Card>
        </div>

        {/* Order list */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Beställningar</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground py-8 text-center">Laddar...</p>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/40" />
                <p className="text-muted-foreground">Inga beställningar ännu</p>
                <Link to="/orders/new">
                  <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Skapa din första beställning
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {orders.map((order) => {
                  const sc = statusConfig[order.status] ?? statusConfig.pending;
                  const Icon = sc.icon;
                  return (
                    <div key={order.id} className="flex items-center justify-between py-4">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{order.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("sv-SE")}
                        </p>
                      </div>
                      <Badge variant={sc.variant} className="gap-1.5">
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
