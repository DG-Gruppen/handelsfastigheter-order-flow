import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  Zap,
  LogOut,
  UserPlus,
  User,
  Building,
  CalendarDays,
  FileText,
  ShoppingCart,
  Truck,
} from "lucide-react";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }
> = {
  pending: { label: "Väntar på attestering", variant: "secondary", icon: Clock },
  approved: { label: "Godkänd", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Avslagen", variant: "destructive", icon: XCircle },
  delivered: { label: "Levererad", variant: "outline", icon: Package },
};

interface Order {
  id: string;
  title: string;
  description: string | null;
  status: string;
  category: string;
  created_at: string;
  approved_at: string | null;
  requester_id: string;
  approver_id: string | null;
  order_reason: string | null;
  recipient_type: string | null;
  recipient_name: string | null;
  recipient_department: string | null;
  recipient_start_date: string | null;
  rejection_reason: string | null;
  updated_at: string;
}

interface OrderItem {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  category_id: string | null;
  order_type_id: string | null;
}

interface Profile {
  full_name: string;
  email: string;
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [requesterProfile, setRequesterProfile] = useState<Profile | null>(null);
  const [approverProfile, setApproverProfile] = useState<Profile | null>(null);
  const [marking, setMarking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      const [orderRes, itemsRes] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).single(),
        supabase.from("order_items").select("*").eq("order_id", id),
      ]);
      const o = orderRes.data as Order | null;
      setOrder(o);
      setItems((itemsRes.data as OrderItem[]) ?? []);

      if (o) {
        const ids = [o.requester_id, o.approver_id].filter(Boolean) as string[];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", ids);
        if (profiles) {
          const req = profiles.find((p: any) => p.user_id === o.requester_id);
          const app = profiles.find((p: any) => p.user_id === o.approver_id);
          if (req) setRequesterProfile({ full_name: req.full_name, email: req.email });
          if (app) setApproverProfile({ full_name: app.full_name, email: app.email });
        }
      }
      setLoading(false);
    };
    load();
  }, [id, user]);

  const handleMarkDelivered = async () => {
    if (!order) return;
    setMarking(true);
    const { error } = await supabase
      .from("orders")
      .update({ status: "delivered" as any })
      .eq("id", order.id);
    if (error) {
      toast.error("Kunde inte uppdatera status");
    } else {
      setOrder({ ...order, status: "delivered" });
      toast.success("Beställningen markerad som levererad");
    }
    setMarking(false);
  };

  if (loading) {
    return (
      <p className="text-muted-foreground py-16 text-center">Laddar...</p>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16 space-y-4">
          <p className="text-muted-foreground">Beställningen hittades inte</p>
          <Link to="/dashboard">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Tillbaka
            </Button>
          </Link>
        </div>
    );
  }

  const sc = statusConfig[order.status] ?? statusConfig.pending;
  const StatusIcon = sc.icon;
  const autoApproved = order.status === "approved" && order.requester_id === order.approver_id;

  // Build timeline
  const timeline: { date: string; label: string; icon: any; color: string }[] = [
    {
      date: order.created_at,
      label: "Beställning skapad",
      icon: FileText,
      color: "text-primary",
    },
  ];
  if (order.approved_at && (order.status === "approved" || order.status === "delivered")) {
    timeline.push({
      date: order.approved_at,
      label: autoApproved ? "Auto-godkänd (chef)" : "Godkänd av attestant",
      icon: CheckCircle2,
      color: "text-success",
    });
  }
  if (order.status === "delivered") {
    timeline.push({
      date: order.updated_at || order.approved_at || order.created_at,
      label: "Levererad",
      icon: Package,
      color: "text-primary",
    });
  }
  if (order.status === "rejected") {
    timeline.push({
      date: order.created_at, // rejection time not stored separately
      label: "Avslagen",
      icon: XCircle,
      color: "text-destructive",
    });
  }

  return (
    <div className="space-y-5 md:space-y-6 max-w-2xl">
        {/* Back + header */}
        <div className="space-y-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Tillbaka
            </Button>
          </Link>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h1 className="font-heading text-lg md:text-2xl font-bold text-foreground min-w-0 break-words">{order.title}</h1>
            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
              {autoApproved && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded-md">
                  <Zap className="h-2.5 w-2.5" /> Auto
                </span>
              )}
              <Badge variant={sc.variant} className="gap-1 text-xs whitespace-nowrap">
                <StatusIcon className="h-3 w-3" />
                <span className="hidden sm:inline">{sc.label}</span>
                <span className="sm:hidden">
                  {order.status === "pending" ? "Väntar" : sc.label}
                </span>
              </Badge>
            </div>
          </div>
          {order.description && (
            <p className="text-sm text-muted-foreground">{order.description}</p>
          )}

          {/* Admin: mark as delivered */}
          {isAdmin && order.status === "approved" && (
            <Button
              onClick={handleMarkDelivered}
              disabled={marking}
              className="gap-2 w-full gradient-primary hover:opacity-90 shadow-md shadow-primary/20 h-12 md:h-10"
            >
              <Truck className="h-4 w-4" />
              {marking ? "Uppdaterar..." : "Markera som levererad"}
            </Button>
          )}
        </div>
          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            {order.order_reason === "end_of_employment" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border bg-destructive/10 text-destructive border-destructive/20">
                <LogOut className="h-3 w-3" /> Offboarding
              </span>
            )}
            {order.recipient_type === "new" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border bg-primary/10 text-primary border-primary/20">
                <UserPlus className="h-3 w-3" /> Nyanställning
              </span>
            )}
          </div>
        </div>

        {/* Recipient info */}
        {(order.recipient_name || order.recipient_department || order.recipient_start_date) && (
          <Card className="glass-card border-t-2 border-t-primary/30">
            <CardHeader className="px-4 md:px-6 pb-2">
              <CardTitle className="font-heading text-sm md:text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Mottagare
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {order.recipient_name && (
                  <div>
                    <p className="text-xs text-muted-foreground">Namn</p>
                    <p className="text-sm font-medium text-foreground">{order.recipient_name}</p>
                  </div>
                )}
                {order.recipient_department && (
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building className="h-3 w-3" /> Avdelning
                    </p>
                    <p className="text-sm font-medium text-foreground">{order.recipient_department}</p>
                  </div>
                )}
                {order.recipient_start_date && (
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> Startdatum
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(order.recipient_start_date).toLocaleDateString("sv-SE")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Equipment / order items */}
        <Card className="glass-card border-t-2 border-t-accent/30">
          <CardHeader className="px-4 md:px-6 pb-2">
            <CardTitle className="font-heading text-sm md:text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-accent" />
              Utrustning ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Inga artiklar registrerade</p>
            ) : (
              <div className="divide-y divide-border/50">
                {items.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">×{item.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* People */}
        <Card className="glass-card border-t-2 border-t-warning/30">
          <CardHeader className="px-4 md:px-6 pb-2">
            <CardTitle className="font-heading text-sm md:text-base">Beställare & Attestant</CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Beställare</p>
                <p className="text-sm font-medium text-foreground">
                  {requesterProfile?.full_name || "—"}
                </p>
                {requesterProfile?.email && (
                  <p className="text-xs text-muted-foreground">{requesterProfile.email}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Attestant</p>
                <p className="text-sm font-medium text-foreground">
                  {autoApproved ? "Auto (chef)" : approverProfile?.full_name || "—"}
                </p>
                {!autoApproved && approverProfile?.email && (
                  <p className="text-xs text-muted-foreground">{approverProfile.email}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rejection reason */}
        {order.status === "rejected" && order.rejection_reason && (
          <Card className="glass-card border-destructive/30">
            <CardContent className="px-4 md:px-6 py-4">
              <p className="text-xs text-muted-foreground mb-1">Anledning till avslag</p>
              <p className="text-sm text-destructive">{order.rejection_reason}</p>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card className="glass-card border-t-2 border-t-muted-foreground/20">
          <CardHeader className="px-4 md:px-6 pb-2">
            <CardTitle className="font-heading text-sm md:text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Tidslinje
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-[9px] top-1 bottom-1 w-px bg-border" />
              {timeline.map((event, i) => {
                const TlIcon = event.icon;
                return (
                  <div key={i} className="relative flex gap-3 items-start">
                    <div className={`absolute -left-6 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border ${event.color}`}>
                      <TlIcon className="h-3 w-3" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{event.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.date).toLocaleString("sv-SE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
