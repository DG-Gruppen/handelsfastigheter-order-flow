import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendHelpdeskEmail } from "@/lib/sendHelpdeskEmail";
import { sendRejectionEmail } from "@/lib/orderEmails";
import { getAppBaseUrl } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Package, Zap, LogOut, UserPlus, Truck,
} from "lucide-react";

import {
  buildTimeline, OrderTimeline, RecipientCard, ItemsCard, SystemsCard,
  PeopleCard, RejectionCard, DeliveryCommentCard,
} from "@/components/orders/OrderDetailCards";
import { RejectDialog, DeliverDialog } from "@/components/orders/OrderActionDialogs";

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
  id: string; title: string; description: string | null; status: string; category: string;
  created_at: string; approved_at: string | null; requester_id: string; approver_id: string | null;
  order_reason: string | null; recipient_type: string | null; recipient_name: string | null;
  recipient_department: string | null; recipient_start_date: string | null;
  rejection_reason: string | null; delivery_comment: string | null; updated_at: string;
}

interface OrderItem { id: string; name: string; description: string | null; quantity: number; category_id: string | null; order_type_id: string | null; }
interface Profile { full_name: string; email: string; }
interface OrderSystem { id: string; system: { id: string; name: string; description: string; icon: string; }; }

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
  const [deliverDialogOpen, setDeliverDialogOpen] = useState(false);
  const [deliveryComment, setDeliveryComment] = useState("");

  const canApprove = order?.status === "pending" && order?.approver_id === user?.id;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadOrder = useCallback(async () => {
    if (!id || !user) return;
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
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids);
      if (profiles) {
        const req = profiles.find((p: any) => p.user_id === o.requester_id);
        const app = profiles.find((p: any) => p.user_id === o.approver_id);
        if (req) setRequesterProfile({ full_name: req.full_name, email: req.email });
        if (app) setApproverProfile({ full_name: app.full_name, email: app.email });
      }
    }
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    if (!id || !user) return;
    loadOrder();
    const channel = supabase
      .channel(`order-detail-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => loadOrder(), 500);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [id, user, loadOrder]);

  const handleMarkDelivered = async () => {
    if (!order) return;
    setMarking(true);
    const comment = deliveryComment.trim();
    const { error } = await supabase
      .from("orders")
      .update({ status: "delivered" as any, delivery_comment: comment || null } as any)
      .eq("id", order.id);
    if (error) {
      toast.error("Kunde inte uppdatera status");
    } else {
      setOrder({ ...order, status: "delivered", delivery_comment: comment || null });
      setDeliverDialogOpen(false);
      setDeliveryComment("");
      toast.success("Beställningen markerad som levererad");

      const notifMessage = comment
        ? `Din beställning "${order.title}" har markerats som levererad.\n\nKommentar från IT: ${comment}`
        : `Din beställning "${order.title}" har markerats som levererad.`;
      await supabase.rpc("create_notification", {
        _user_id: order.requester_id, _title: "Beställning levererad",
        _message: notifMessage, _type: "order_delivered", _reference_id: order.id,
      });

      if (requesterProfile?.email) {
        const orderUrl = `${window.location.origin}/orders/${order.id}`;
        const commentHtml = comment
          ? `<div style="margin:16px 0;padding:12px 16px;background:#f9f9f9;border-left:4px solid #1a1a2e;border-radius:4px;">
               <p style="margin:0 0 4px;font-size:12px;color:#666;font-weight:bold;">Kommentar från IT:</p>
               <p style="margin:0;color:#333;">${comment}</p>
             </div>` : "";
        const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1a1a2e;color:white;padding:20px 24px;border-radius:8px 8px 0 0;"><h1 style="margin:0;font-size:18px;">📦 Beställning levererad</h1></div>
          <div style="padding:24px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px;">
            <p style="margin:0 0 16px;color:#333;">Hej <strong>${requesterProfile.full_name}</strong>,</p>
            <p style="margin:0 0 16px;color:#333;">Din beställning <strong>"${order.title}"</strong> har nu markerats som levererad.</p>
            ${order.recipient_name ? `<p style="margin:0 0 16px;color:#333;">Mottagare: <strong>${order.recipient_name}</strong></p>` : ""}
            ${commentHtml}
            <div style="margin:24px 0 0;padding:16px;background:#f0f4ff;border-radius:8px;text-align:center;">
              <a href="${orderUrl}" style="display:inline-block;padding:10px 24px;background:#1a1a2e;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Visa beställning</a>
              <p style="margin:8px 0 0;font-size:12px;color:#666;">Länken kräver inloggning</p>
            </div></div></div>`;
        try { await supabase.functions.invoke("send-email", { body: { to: requesterProfile.email, subject: `[SHF IT Beställning] Levererad: ${order.title}`, html } }); }
        catch (err) { console.error("Failed to send delivery email:", err); }
      }
    }
    setMarking(false);
  };

  const handleApprove = async () => {
    if (!order) return;
    setApproving(true);
    const { error } = await supabase.from("orders").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", order.id);
    if (error) { toast.error("Kunde inte godkänna beställningen"); }
    else {
      setOrder({ ...order, status: "approved", approved_at: new Date().toISOString() });
      toast.success("Beställningen har godkänts!");

      if (user && order.requester_id !== user.id) {
        const approverName = approverProfile?.full_name || "Attestanten";
        await supabase.rpc("create_notification", {
          _user_id: order.requester_id, _title: "Beställning godkänd",
          _message: `${approverName} har godkänt: ${order.title}`, _type: "order_approved", _reference_id: order.id,
        });
      }

      if (requesterProfile?.email) {
        const orderUrl = `${window.location.origin}/orders/${order.id}`;
        const approverName = approverProfile?.full_name || "Attestanten";
        const itemsHtml = items.map((i) => `<li><strong>${i.name}</strong>${i.quantity > 1 ? ` ×${i.quantity}` : ""}</li>`).join("");
        const approvalHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1a1a2e;color:white;padding:20px 24px;border-radius:8px 8px 0 0;"><h1 style="margin:0;font-size:18px;">✅ Beställning godkänd</h1></div>
          <div style="padding:24px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px;">
            <p style="margin:0 0 16px;color:#333;">Hej <strong>${requesterProfile.full_name}</strong>,</p>
            <p style="margin:0 0 16px;color:#333;">Din beställning <strong>"${order.title}"</strong> har godkänts av <strong>${approverName}</strong> och skickats vidare till IT för hantering.</p>
            <h3 style="margin:16px 0 8px;color:#1a1a2e;">Beställd utrustning</h3><ul>${itemsHtml}</ul>
            <div style="margin:24px 0 0;padding:16px;background:#f0f4ff;border-radius:8px;text-align:center;">
              <a href="${orderUrl}" style="display:inline-block;padding:10px 24px;background:#1a1a2e;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Visa din beställning</a>
              <p style="margin:8px 0 0;font-size:12px;color:#666;">Länken kräver inloggning</p>
            </div></div></div>`;
        try { await supabase.functions.invoke("send-email", { body: { to: requesterProfile.email, subject: `[SHF IT] Din beställning har godkänts: ${order.title}`, html: approvalHtml } }); }
        catch (err) { console.error("Failed to send approval confirmation email:", err); }
      }

      const systemsList = orderSystems.map((os) => ({ name: os.system?.name || "", description: os.system?.description || null }));
      await sendHelpdeskEmail({
        orderId: order.id, title: order.title, description: order.description,
        recipientName: order.recipient_name, recipientDepartment: order.recipient_department,
        recipientStartDate: order.recipient_start_date, orderReason: order.order_reason,
        requesterName: requesterProfile?.full_name || "Okänd", requesterEmail: requesterProfile?.email || "",
        items: items.map((i) => ({ name: i.name, description: i.description, quantity: i.quantity })),
        systems: systemsList,
      });
    }
    setApproving(false);
  };

  const handleReject = async () => {
    if (!order) return;
    const { error } = await supabase.from("orders").update({ status: "rejected", rejection_reason: rejectionReason.trim() || null }).eq("id", order.id);
    if (error) { toast.error("Kunde inte avslå beställningen"); }
    else {
      setOrder({ ...order, status: "rejected", rejection_reason: rejectionReason.trim() || null });
      toast.success("Beställningen har avslagits");
      setRejectDialogOpen(false);
      setRejectionReason("");
      if (user && order.requester_id !== user.id) {
        const approverName = approverProfile?.full_name || "Attestanten";
        await supabase.rpc("create_notification", {
          _user_id: order.requester_id, _title: "Beställning avslagen",
          _message: `${approverName} har avslagit: ${order.title}${rejectionReason.trim() ? ` – "${rejectionReason.trim()}"` : ""}`,
          _type: "order_rejected", _reference_id: order.id,
        });

        // Send rejection email to requester
        if (requesterProfile?.email) {
          await sendRejectionEmail({
            orderId: order.id,
            title: order.title,
            requesterName: requesterProfile.full_name,
            requesterEmail: requesterProfile.email,
            approverName,
            rejectionReason: rejectionReason.trim() || null,
          });
        }
      }
    }
  };

  if (loading) return <p className="text-muted-foreground py-16 text-center">Laddar...</p>;

  if (!order) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">Beställningen hittades inte</p>
        <Link to="/dashboard"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Tillbaka</Button></Link>
      </div>
    );
  }

  const sc = statusConfig[order.status] ?? statusConfig.pending;
  const StatusIcon = sc.icon;
  const autoApproved = order.status === "approved" && order.requester_id === order.approver_id;
  const timeline = buildTimeline(order);

  return (
    <div className="space-y-5 md:space-y-6 max-w-2xl">
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
                <span className="sm:hidden">{order.status === "pending" ? "Väntar" : sc.label}</span>
              </Badge>
            </div>
          </div>
          {order.description && <p className="text-sm text-muted-foreground">{order.description}</p>}

          {canApprove && (
            <div className="flex gap-2">
              <Button className="gap-1.5 flex-1 h-12 md:h-10 gradient-primary hover:opacity-90 shadow-sm shadow-primary/20" onClick={handleApprove} disabled={approving}>
                <CheckCircle2 className="h-4 w-4" /> {approving ? "Godkänner..." : "Godkänn"}
              </Button>
              <Button variant="outline" className="gap-1.5 flex-1 text-destructive h-12 md:h-10" onClick={() => setRejectDialogOpen(true)}>
                <XCircle className="h-4 w-4" /> Avslå
              </Button>
            </div>
          )}

          {isAdmin && order.status === "approved" && (
            <Button onClick={() => setDeliverDialogOpen(true)} className="gap-2 w-full gradient-primary hover:opacity-90 shadow-md shadow-primary/20 h-12 md:h-10">
              <Truck className="h-4 w-4" /> Markera som levererad
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

      <RecipientCard order={order} />
      <ItemsCard items={items} />
      <SystemsCard orderSystems={orderSystems} />
      <PeopleCard requester={requesterProfile} approver={approverProfile} autoApproved={autoApproved} />
      {order.status === "rejected" && order.rejection_reason && <RejectionCard reason={order.rejection_reason} />}
      {order.status === "delivered" && order.delivery_comment && <DeliveryCommentCard comment={order.delivery_comment} />}
      <OrderTimeline timeline={timeline} />

      <RejectDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen} reason={rejectionReason} onReasonChange={setRejectionReason} onReject={handleReject} />
      <DeliverDialog open={deliverDialogOpen} onOpenChange={setDeliverDialogOpen} comment={deliveryComment} onCommentChange={setDeliveryComment} onDeliver={handleMarkDelivered} marking={marking} />
    </div>
  );
}
