import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Inbox } from "lucide-react";
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
      <div className="space-y-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Attestering</h1>
          <p className="text-muted-foreground mt-1">Beställningar som väntar på ditt godkännande</p>
        </div>

        {/* Pending */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Väntar på godkännande ({pendingOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground py-8 text-center">Laddar...</p>
            ) : pendingOrders.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Inbox className="h-12 w-12 mx-auto text-muted-foreground/40" />
                <p className="text-muted-foreground">Inga beställningar att attestera</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-foreground">{order.title}</p>
                        {order.description && (
                          <p className="text-sm text-muted-foreground mt-1">{order.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(order.created_at).toLocaleDateString("sv-SE")}
                        </p>
                      </div>
                      <Badge variant="secondary" className="capitalize">{order.category}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1.5" onClick={() => handleApprove(order.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Godkänn
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-destructive"
                        onClick={() => setRejectingId(order.id)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
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
            <CardHeader>
              <CardTitle className="font-heading text-lg">Hanterade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {handledOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-foreground">{order.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("sv-SE")}
                      </p>
                    </div>
                    <Badge variant={order.status === "approved" ? "default" : "destructive"}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avslå beställning</DialogTitle>
            <DialogDescription>Ange en anledning till avslaget (valfritt)</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Anledning..."
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingId(null)}>Avbryt</Button>
            <Button variant="destructive" onClick={handleReject}>Avslå</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
