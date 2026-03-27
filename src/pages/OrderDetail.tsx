import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useModulePermission } from "@/hooks/useModulePermission";
import { sendHelpdeskEmail } from "@/lib/sendHelpdeskEmail";
import { sendRejectionEmail, sendApprovalEmail, sendDeliveryEmail } from "@/lib/orderEmails";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft, Zap, LogOut, UserPlus, Truck, CheckCircle2, XCircle,
} from "lucide-react";

import {
  buildTimeline, OrderTimeline, RecipientCard, ItemsCard, SystemsCard,
  PeopleCard, RejectionCard, DeliveryCommentCard,
} from "@/components/orders/OrderDetailCards";
import { RejectDialog, DeliverDialog } from "@/components/orders/OrderActionDialogs";

import { ORDER_STATUS_CONFIG } from "@/lib/constants";

interface Order {
  id: string; title: string; description: string | null; status: string; category: string;
  created_at: string; approved_at: string | null; requester_id: string; approver_id: string | null;
  order_reason: string | null; recipient_type: string | null; recipient_name: string | null;
  recipient_department: string | null; recipient_start_date: string | null;
  rejection_reason: string | null; delivery_comment: string | null; updated_at: string;
}

interface OrderItem { id: string; name: string; description: string | null; quantity: number; category_id: string | null; order_type_id: string | null; }
interface Profile { full_name: string; email: string; department?: string | null; phone?: string | null; region_id?: string | null; }
interface OrderSystem { id: string; system: { id: string; name: string; description: string; icon: string; }; }

const ORDER_COLUMNS = "id,title,description,status,category,created_at,approved_at,requester_id,approver_id,order_reason,recipient_type,recipient_name,recipient_department,recipient_start_date,rejection_reason,delivery_comment,updated_at";
const ORDER_ITEM_COLUMNS = "id,name,description,quantity,category_id,order_type_id";

async function fetchOrderDetail(id: string) {
  // Fetch order, items, and systems in parallel
  const [orderRes, itemsRes, systemsRes] = await Promise.all([
    supabase.from("orders").select(ORDER_COLUMNS).eq("id", id).single(),
    supabase.from("order_items").select(ORDER_ITEM_COLUMNS).eq("order_id", id),
    supabase.from("order_systems").select("id, system:systems(id, name, description, icon)").eq("order_id", id),
  ]);

  const order = orderRes.data as Order | null;
  const items = (itemsRes.data as OrderItem[]) ?? [];
  const orderSystems = (systemsRes.data as any[]) ?? [];

  // Fetch profiles in parallel (not sequentially after order)
  let requesterProfile: Profile | null = null;
  let approverProfile: Profile | null = null;
  let requesterRegionName: string | null = null;

  if (order) {
    const ids = [order.requester_id, order.approver_id].filter(Boolean) as string[];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, department, phone, region_id")
      .in("user_id", ids);
    if (profiles) {
      const req = profiles.find((p: any) => p.user_id === order.requester_id);
      const app = profiles.find((p: any) => p.user_id === order.approver_id);
      if (req) {
        requesterProfile = { full_name: req.full_name, email: req.email, department: req.department, phone: req.phone, region_id: req.region_id };
        if (req.region_id) {
          const { data: region } = await supabase.from("regions").select("name").eq("id", req.region_id).single();
          requesterRegionName = region?.name || null;
        }
      }
      if (app) approverProfile = { full_name: app.full_name, email: app.email };
    }
  }

  return { order, items, orderSystems, requesterProfile, approverProfile, requesterRegionName };
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, roles } = useAuth();
  const { canEdit: canEditAdmin } = useModulePermission("admin");
  const isAdmin = roles.includes("admin") || canEditAdmin;
  const queryClient = useQueryClient();

  const [marking, setMarking] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approving, setApproving] = useState(false);
  const [deliverDialogOpen, setDeliverDialogOpen] = useState(false);
  const [deliveryComment, setDeliveryComment] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryKey = ["order-detail", id];

  const { data, isLoading: loading } = useQuery({
    queryKey,
    queryFn: () => fetchOrderDetail(id!),
    enabled: !!id && !!user,
    staleTime: 30 * 1000,
  });

  const order = data?.order ?? null;
  const items = data?.items ?? [];
  const orderSystems = data?.orderSystems ?? [];
  const requesterProfile = data?.requesterProfile ?? null;
  const approverProfile = data?.approverProfile ?? null;

  const canApprove = order?.status === "pending" && order?.approver_id === user?.id;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, id]);

  // Realtime subscription
  useEffect(() => {
    if (!id || !user) return;
    const channel = supabase
      .channel(`order-detail-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => invalidate(), 500);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [id, user, invalidate]);

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
      setDeliverDialogOpen(false);
      setDeliveryComment("");
      toast.success("Beställningen markerad som levererad");
      invalidate();

      const notifMessage = comment
        ? `Din beställning "${order.title}" har markerats som levererad.\n\nKommentar från IT: ${comment}`
        : `Din beställning "${order.title}" har markerats som levererad.`;
      await supabase.rpc("create_notification", {
        _user_id: order.requester_id, _title: "Beställning levererad",
        _message: notifMessage, _type: "order_delivered", _reference_id: order.id,
      });

      if (requesterProfile?.email) {
        await sendDeliveryEmail({
          orderId: order.id,
          recipientName: requesterProfile.full_name,
          recipientEmail: requesterProfile.email,
          title: order.title,
          orderRecipientName: order.recipient_name,
          comment,
        });
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
      toast.success("Beställningen har godkänts!");
      invalidate();

      if (user && order.requester_id !== user.id) {
        const approverName = approverProfile?.full_name || "Attestanten";
        await supabase.rpc("create_notification", {
          _user_id: order.requester_id, _title: "Beställning godkänd",
          _message: `${approverName} har godkänt: ${order.title}`, _type: "order_approved", _reference_id: order.id,
        });
      }

      if (requesterProfile?.email) {
        await sendApprovalEmail({
          orderId: order.id,
          recipientName: requesterProfile.full_name,
          recipientEmail: requesterProfile.email,
          title: order.title,
          approverName: approverProfile?.full_name || "Attestanten",
          items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
        });
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
    if (error) {
      console.error("Failed to reject order:", error);
      toast.error("Kunde inte avslå beställningen");
      return;
    }

    toast.success("Beställningen har avslagits");
    setRejectDialogOpen(false);
    setRejectionReason("");
    invalidate();

    if (user && order.requester_id !== user.id) {
      const approverName = approverProfile?.full_name || "Attestanten";
      await supabase.rpc("create_notification", {
        _user_id: order.requester_id, _title: "Beställning avslagen",
        _message: `${approverName} har avslagit: ${order.title}${rejectionReason.trim() ? ` – "${rejectionReason.trim()}"` : ""}`,
        _type: "order_rejected", _reference_id: order.id,
      });

      if (requesterProfile?.email) {
        try {
          await sendRejectionEmail({
            orderId: order.id,
            title: order.title,
            requesterName: requesterProfile.full_name,
            requesterEmail: requesterProfile.email,
            approverName,
            rejectionReason: rejectionReason.trim() || null,
          });
        } catch (err) {
          console.error("Failed to send rejection email:", err);
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

  const sc = ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG.pending;
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
