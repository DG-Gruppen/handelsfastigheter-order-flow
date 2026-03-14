import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendHelpdeskEmail } from "@/lib/sendHelpdeskEmail";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
  Monitor,
} from "lucide-react";
import { getIcon } from "@/lib/icons";

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

interface OrderSystem {
  id: string;
  system: {
    id: string;
    name: string;
    description: string;
    icon: string;
  };
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [orderSystems, setOrderSystems] = useState<OrderSystem[]>([]);
  const [requesterProfile, setRequesterProfile] = useState<Profile | null>(null);
  const [approverProfile, setApproverProfile] = useState<Profile | null>(null);
  const [marking, setMarking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approving, setApproving] = useState(false);

  const canApprove = order?.status === "pending" && order?.approver_id === user?.id;

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      const [orderRes, itemsRes, systemsRes] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).single(),
        supabase.from("order_items").select("*").eq("order_id", id),
        supabase.from("order_systems").select("id, system:systems(id, name, description, icon)").eq("order_id", id),
      ]);
      const o = orderRes.data as Order | null;
      setOrder(o);
      setItems((itemsRes.data as OrderItem[]) ?? []);
      setOrderSystems((systemsRes.data as any[]) ?? []);

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

      // In-app notification to requester
      await supabase.from("notifications").insert({
        user_id: order.requester_id,
        title: "Beställning levererad",
        message: `Din beställning "${order.title}" har markerats som levererad.`,
        type: "order_delivered",
        reference_id: order.id,
      } as any);

      // Email notification to requester
      if (requesterProfile?.email) {
        const orderUrl = `${window.location.origin}/orders/${order.id}`;
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#1a1a2e;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;font-size:18px;">📦 Beställning levererad</h1>
            </div>
            <div style="padding:24px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px;">
              <p style="margin:0 0 16px;color:#333;">Hej <strong>${requesterProfile.full_name}</strong>,</p>
              <p style="margin:0 0 16px;color:#333;">Din beställning <strong>"${order.title}"</strong> har nu markerats som levererad.</p>
              ${order.recipient_name ? `<p style="margin:0 0 16px;color:#333;">Mottagare: <strong>${order.recipient_name}</strong></p>` : ""}
              <div style="margin:24px 0 0;padding:16px;background:#f0f4ff;border-radius:8px;text-align:center;">
                <a href="${orderUrl}" style="display:inline-block;padding:10px 24px;background:#1a1a2e;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Visa beställning</a>
                <p style="margin:8px 0 0;font-size:12px;color:#666;">Länken kräver inloggning</p>
              </div>
            </div>
          </div>
        `;
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              to: requesterProfile.email,
              subject: `[SHF IT Beställning] Levererad: ${order.title}`,
              html,
            },
          });
        } catch (err) {
          console.error("Failed to send delivery email:", err);
        }
      }
    }
    setMarking(false);
  };

  const handleApprove = async () => {
    if (!order) return;
    setApproving(true);
    const { error } = await supabase
      .from("orders")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", order.id);
    if (error) {
      toast.error("Kunde inte godkänna beställningen");
    } else {
      setOrder({ ...order, status: "approved", approved_at: new Date().toISOString() });
      toast.success("Beställningen har godkänts!");

      // Notify requester about approval
      if (user && order.requester_id !== user.id) {
        const approverName = approverProfile?.full_name || "Attestanten";
        await supabase.from("notifications").insert({
          user_id: order.requester_id,
          title: "Beställning godkänd",
          message: `${approverName} har godkänt: ${order.title}`,
          type: "order_approved",
          reference_id: order.id,
        } as any);
      }

      // Send helpdesk email
      const systemsList = orderSystems.map((os) => ({
        name: os.system?.name || "",
        description: os.system?.description || null,
      }));
      await sendHelpdeskEmail({
        orderId: order.id,
        title: order.title,
        description: order.description,
        recipientName: order.recipient_name,
        recipientDepartment: order.recipient_department,
        recipientStartDate: order.recipient_start_date,
        orderReason: order.order_reason,
        requesterName: requesterProfile?.full_name || "Okänd",
        requesterEmail: requesterProfile?.email || "",
        items: items.map((i) => ({ name: i.name, description: i.description, quantity: i.quantity })),
        systems: systemsList,
      });
    }
    setApproving(false);
  };

  const handleReject = async () => {
    if (!order) return;
    const { error } = await supabase
      .from("orders")
      .update({ status: "rejected", rejection_reason: rejectionReason.trim() || null })
      .eq("id", order.id);
    if (error) {
      toast.error("Kunde inte avslå beställningen");
    } else {
      setOrder({ ...order, status: "rejected", rejection_reason: rejectionReason.trim() || null });
      toast.success("Beställningen har avslagits");
      setRejectDialogOpen(false);
      setRejectionReason("");

      // Notify requester about rejection
      if (user && order.requester_id !== user.id) {
        const approverName = approverProfile?.full_name || "Attestanten";
        await supabase.from("notifications").insert({
          user_id: order.requester_id,
          title: "Beställning avslagen",
          message: `${approverName} har avslagit: ${order.title}${rejectionReason.trim() ? ` – "${rejectionReason.trim()}"` : ""}`,
          type: "order_rejected",
          reference_id: order.id,
        } as any);
      }
    }
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

          {/* Approval actions for approver */}
          {canApprove && (
            <div className="flex gap-2">
              <Button
                className="gap-1.5 flex-1 h-12 md:h-10 gradient-primary hover:opacity-90 shadow-sm shadow-primary/20"
                onClick={handleApprove}
                disabled={approving}
              >
                <CheckCircle2 className="h-4 w-4" />
                {approving ? "Godkänner..." : "Godkänn"}
              </Button>
              <Button
                variant="outline"
                className="gap-1.5 flex-1 text-destructive h-12 md:h-10"
                onClick={() => setRejectDialogOpen(true)}
              >
                <XCircle className="h-4 w-4" />
                Avslå
              </Button>
            </div>
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

        {/* Systems & licenses */}
        {orderSystems.length > 0 && (
          <Card className="glass-card border-t-2 border-t-primary/30">
            <CardHeader className="px-4 md:px-6 pb-2">
              <CardTitle className="font-heading text-sm md:text-base flex items-center gap-2">
                <Monitor className="h-4 w-4 text-primary" />
                System & Licenser ({orderSystems.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {orderSystems.map((os) => {
                  const SysIcon = getIcon(os.system?.icon || "monitor");
                  return (
                    <div key={os.id} className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-secondary/20 p-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <SysIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{os.system?.name}</p>
                        {os.system?.description && (
                          <p className="text-xs text-muted-foreground truncate">{os.system.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Reject dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent className="mx-4 max-w-lg glass-surface">
            <DialogHeader>
              <DialogTitle>Avslå beställning</DialogTitle>
              <DialogDescription>Ange en anledning till avslaget (valfritt)</DialogDescription>
            </DialogHeader>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Anledning..."
              maxLength={500}
              className="resize-none"
            />
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)} className="w-full sm:w-auto h-11">
                Avbryt
              </Button>
              <Button variant="destructive" onClick={handleReject} className="w-full sm:w-auto h-11">
                Avslå
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
