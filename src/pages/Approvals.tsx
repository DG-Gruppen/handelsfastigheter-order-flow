import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Inbox, LogOut, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Order {
  id: string;
  title: string;
  description: string;
  status: string;
  category: string;
  created_at: string;
  requester_id: string;
  approver_id: string | null;
  order_reason: string | null;
  recipient_type: string | null;
}

export default function Approvals() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchOrders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("approver_id", user.id)
      .order("created_at", { ascending: false });
    setOrders((data as Order[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const handleApprove = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", orderId);
    if (error) {
      toast.error("Kunde inte godkänna beställningen");
    } else {
      toast.success("Beställningen har godkänts!");
      fetchOrders();
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    const { error } = await supabase
      .from("orders")
      .update({ status: "rejected", rejection_reason: rejectionReason.trim() || null })
      .eq("id", rejectingId);
    if (error) {
      toast.error("Kunde inte avslå beställningen");
    } else {
      toast.success("Beställningen har avslagits");
      setRejectingId(null);
      setRejectionReason("");
      fetchOrders();
    }
  };

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const handledOrders = orders.filter((o) => o.status !== "pending");

  return (
    <AppLayout>
      <div className="space-y-5 md:space-y-8">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">Attestering</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Beställningar som väntar på ditt godkännande
          </p>
        </div>

        {/* Pending */}
        <Card className="glass-card">
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="font-heading text-base md:text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Väntar ({pendingOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            {loading ? (
              <p className="text-muted-foreground py-8 text-center">Laddar...</p>
            ) : pendingOrders.length === 0 ? (
              <div className="text-center py-10 space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60">
                  <Inbox className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">Inga beställningar att attestera</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingOrders.map((order, i) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-border/50 bg-secondary/20 p-3.5 md:p-4 space-y-3 animate-fade-up"
                    style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm md:text-base text-foreground">{order.title}</p>
                        {order.description && (
                          <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">
                            {order.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {new Date(order.created_at).toLocaleDateString("sv-SE")}
                        </p>
                      </div>
                      <Badge variant="secondary" className="capitalize text-xs shrink-0">
                        {order.category}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="gap-1.5 flex-1 md:flex-none h-11 md:h-9 gradient-primary hover:opacity-90 shadow-sm shadow-primary/20"
                        onClick={() => handleApprove(order.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Godkänn
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-1.5 flex-1 md:flex-none text-destructive h-11 md:h-9"
                        onClick={() => setRejectingId(order.id)}
                      >
                        <XCircle className="h-4 w-4" />
                        Avslå
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Handled */}
        {handledOrders.length > 0 && (
          <Card className="glass-card">
            <CardHeader className="px-4 md:px-6">
              <CardTitle className="font-heading text-base md:text-lg">Hanterade</CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="divide-y divide-border/50 -mx-4 md:mx-0">
                {handledOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between px-4 md:px-0 py-3.5">
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="font-medium text-sm text-foreground truncate">{order.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("sv-SE")}
                      </p>
                    </div>
                    <Badge
                      variant={order.status === "approved" ? "default" : "destructive"}
                      className="shrink-0 text-xs"
                    >
                      {order.status === "approved" ? "Godkänd" : "Avslagen"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reject dialog */}
      <Dialog open={!!rejectingId} onOpenChange={() => setRejectingId(null)}>
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
            <Button variant="outline" onClick={() => setRejectingId(null)} className="w-full sm:w-auto h-11">
              Avbryt
            </Button>
            <Button variant="destructive" onClick={handleReject} className="w-full sm:w-auto h-11">
              Avslå
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
