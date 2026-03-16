import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Clock, CheckCircle2, XCircle, Package, User, Building, CalendarDays,
  ShoppingCart, Truck, Monitor, FileText,
} from "lucide-react";
import { getIcon } from "@/lib/icons";

// ── Timeline ──

interface TimelineEvent {
  date: string;
  label: string;
  icon: any;
  color: string;
}

export function buildTimeline(order: {
  created_at: string;
  approved_at: string | null;
  updated_at: string;
  status: string;
  requester_id: string;
  approver_id: string | null;
}): TimelineEvent[] {
  const autoApproved = order.status === "approved" && order.requester_id === order.approver_id;
  const timeline: TimelineEvent[] = [
    { date: order.created_at, label: "Beställning skapad", icon: FileText, color: "text-primary" },
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
    timeline.push({ date: order.created_at, label: "Avslagen", icon: XCircle, color: "text-destructive" });
  }
  return timeline;
}

export const OrderTimeline = memo(function OrderTimeline({ timeline }: { timeline: TimelineEvent[] }) {
  return (
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
                    {new Date(event.date).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

// ── Recipient Card ──

export const RecipientCard = memo(function RecipientCard({ order }: {
  order: { recipient_name: string | null; recipient_department: string | null; recipient_start_date: string | null };
}) {
  if (!order.recipient_name && !order.recipient_department && !order.recipient_start_date) return null;
  return (
    <Card className="glass-card border-t-2 border-t-primary/30">
      <CardHeader className="px-4 md:px-6 pb-2">
        <CardTitle className="font-heading text-sm md:text-base flex items-center gap-2">
          <User className="h-4 w-4 text-primary" /> Mottagare
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
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Building className="h-3 w-3" /> Avdelning</p>
              <p className="text-sm font-medium text-foreground">{order.recipient_department}</p>
            </div>
          )}
          {order.recipient_start_date && (
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Startdatum</p>
              <p className="text-sm font-medium text-foreground">{new Date(order.recipient_start_date).toLocaleDateString("sv-SE")}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

// ── Items Card ──

interface OrderItem { id: string; name: string; description: string | null; quantity: number; }

export const ItemsCard = memo(function ItemsCard({ items }: { items: OrderItem[] }) {
  return (
    <Card className="glass-card border-t-2 border-t-accent/30">
      <CardHeader className="px-4 md:px-6 pb-2">
        <CardTitle className="font-heading text-sm md:text-base flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-accent" /> Utrustning ({items.length})
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
                  {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">×{item.quantity}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// ── Systems Card ──

interface OrderSystem { id: string; system: { id: string; name: string; description: string; icon: string; }; }

export const SystemsCard = memo(function SystemsCard({ orderSystems }: { orderSystems: OrderSystem[] }) {
  if (orderSystems.length === 0) return null;
  return (
    <Card className="glass-card border-t-2 border-t-primary/30">
      <CardHeader className="px-4 md:px-6 pb-2">
        <CardTitle className="font-heading text-sm md:text-base flex items-center gap-2">
          <Monitor className="h-4 w-4 text-primary" /> System & Licenser ({orderSystems.length})
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
                  {os.system?.description && <p className="text-xs text-muted-foreground truncate">{os.system.description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

// ── People Card ──

interface Profile { full_name: string; email: string; }

export const PeopleCard = memo(function PeopleCard({ requester, approver, autoApproved }: {
  requester: Profile | null; approver: Profile | null; autoApproved: boolean;
}) {
  return (
    <Card className="glass-card border-t-2 border-t-warning/30">
      <CardHeader className="px-4 md:px-6 pb-2">
        <CardTitle className="font-heading text-sm md:text-base">Beställare & Attestant</CardTitle>
      </CardHeader>
      <CardContent className="px-4 md:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Beställare</p>
            <p className="text-sm font-medium text-foreground">{requester?.full_name || "—"}</p>
            {requester?.email && <p className="text-xs text-muted-foreground">{requester.email}</p>}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Attestant</p>
            <p className="text-sm font-medium text-foreground">{autoApproved ? "Auto (chef)" : approver?.full_name || "—"}</p>
            {!autoApproved && approver?.email && <p className="text-xs text-muted-foreground">{approver.email}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

// ── Status info cards ──

export const RejectionCard = memo(function RejectionCard({ reason }: { reason: string }) {
  return (
    <Card className="glass-card border-destructive/30">
      <CardContent className="px-4 md:px-6 py-4">
        <p className="text-xs text-muted-foreground mb-1">Anledning till avslag</p>
        <p className="text-sm text-destructive">{reason}</p>
      </CardContent>
    </Card>
  );
});

export const DeliveryCommentCard = memo(function DeliveryCommentCard({ comment }: { comment: string }) {
  return (
    <Card className="glass-card border-t-2 border-t-primary/30">
      <CardContent className="px-4 md:px-6 py-4">
        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
          <Truck className="h-3 w-3" /> Kommentar från IT vid leverans
        </p>
        <p className="text-sm text-foreground">{comment}</p>
      </CardContent>
    </Card>
  );
});
