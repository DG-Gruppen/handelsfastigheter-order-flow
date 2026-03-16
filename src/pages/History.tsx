import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare } from "lucide-react";
import { Clock, CheckCircle2, XCircle, Package, Zap, LogOut, UserPlus, Search, History as HistoryIcon } from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Väntar", variant: "secondary", icon: Clock },
  approved: { label: "Godkänd", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Avslagen", variant: "destructive", icon: XCircle },
  delivered: { label: "Levererad", variant: "outline", icon: Package },
};

interface HistoryOrder {
  id: string;
  title: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  requester_id: string;
  approver_id: string | null;
  order_reason: string | null;
  recipient_type: string | null;
  recipient_name: string | null;
  requester_name?: string;
  delivery_comment: string | null;
}

export default function History() {
  const { user, roles, profile } = useAuth();
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager");

  useEffect(() => {
    if (!user || !profile) return;

    const fetchHistory = async () => {
      setLoading(true);

      if (isAdmin) {
        // Admins see all orders
        const { data } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });

        // Fetch requester names
        const requesterIds = [...new Set((data ?? []).map(o => o.requester_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", requesterIds);

        const nameMap = new Map((profiles ?? []).map(p => [p.user_id, p.full_name]));
        setOrders((data ?? []).map(o => ({
          ...o,
          requester_name: nameMap.get(o.requester_id) || "Okänd",
        })));
      } else if (isManager) {
        // Managers see own + their employees' orders
        // Get employees managed by this user
        const { data: managedProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("manager_id", profile.id);

        const employeeIds = (managedProfiles ?? []).map(p => p.user_id);
        const allUserIds = [user.id, ...employeeIds];

        const { data } = await supabase
          .from("orders")
          .select("*")
          .in("requester_id", allUserIds)
          .order("created_at", { ascending: false });

        const nameMap = new Map([
          [user.id, profile.full_name],
          ...(managedProfiles ?? []).map(p => [p.user_id, p.full_name] as [string, string]),
        ]);

        setOrders((data ?? []).map(o => ({
          ...o,
          requester_name: nameMap.get(o.requester_id) || "Okänd",
        })));
      } else {
        // Employees see only own orders
        const { data } = await supabase
          .from("orders")
          .select("*")
          .eq("requester_id", user.id)
          .order("created_at", { ascending: false });

        setOrders((data ?? []).map(o => ({
          ...o,
          requester_name: profile.full_name,
        })));
      }

      setLoading(false);
    };

    fetchHistory();
  }, [user, profile, isAdmin, isManager]);

  const filtered = orders.filter(o => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.title.toLowerCase().includes(q) ||
        (o.requester_name?.toLowerCase().includes(q)) ||
        (o.recipient_name?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  function getOrderTag(order: HistoryOrder) {
    if (order.order_reason === "end_of_employment") {
      return { label: "Offboarding", icon: LogOut, className: "bg-destructive/10 text-destructive border-destructive/20" };
    }
    if (order.recipient_type === "new") {
      return { label: "Nyanställning", icon: UserPlus, className: "bg-primary/10 text-primary border-primary/20" };
    }
    return null;
  }

  const showRequester = isAdmin || isManager;

  return (
    <div className="space-y-5 md:space-y-8">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">
            Historik
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin ? "Alla beställningar i systemet" : isManager ? "Dina och dina anställdas beställningar" : "Dina beställningar"}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sök på titel, namn..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-12 md:h-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] h-12 md:h-10">
              <SelectValue placeholder="Alla statusar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla statusar</SelectItem>
              <SelectItem value="pending">Väntar</SelectItem>
              <SelectItem value="approved">Godkänd</SelectItem>
              <SelectItem value="rejected">Avslagen</SelectItem>
              <SelectItem value="delivered">Levererad</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Order list */}
        <Card className="glass-card border-t-2 border-t-primary/30">
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="font-heading text-base md:text-lg flex items-center gap-2">
              <HistoryIcon className="h-5 w-5 text-primary" />
              {filtered.length} beställning{filtered.length !== 1 ? "ar" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            {loading ? (
              <p className="text-muted-foreground py-8 text-center">Laddar...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 md:py-12 space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60">
                  <HistoryIcon className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">Ingen historik att visa</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50 -mx-4 md:mx-0">
                {filtered.map((order) => {
                  const sc = statusConfig[order.status] ?? statusConfig.pending;
                  const Icon = sc.icon;
                  const autoApproved = order.status === "approved" && order.requester_id === order.approver_id;
                  const tag = getOrderTag(order);
                  return (
                    <Link
                      key={order.id}
                      to={`/orders/${order.id}`}
                      className="flex items-center justify-between px-4 md:px-0 py-3.5 md:py-4 active:bg-secondary/30 transition-colors group hover:bg-secondary/20"
                    >
                      <div className="space-y-1 min-w-0 flex-1 mr-3">
                        <p className="font-medium text-sm md:text-base text-foreground truncate">
                          {order.title}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString("sv-SE")}
                          </p>
                          {showRequester && order.requester_name && (
                            <span className="text-xs text-muted-foreground">
                              · {order.requester_name}
                            </span>
                          )}
                          {tag && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${tag.className}`}>
                              <tag.icon className="h-2.5 w-2.5" />
                              {tag.label}
                            </span>
                          )}
                          {order.status === "delivered" && order.delivery_comment && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-info/10 text-info border-info/20" title={order.delivery_comment}>
                              <MessageSquare className="h-2.5 w-2.5" />
                              Kommentar
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {autoApproved && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded-md">
                            <Zap className="h-2.5 w-2.5" />
                            Auto
                          </span>
                        )}
                        <Badge variant={sc.variant} className="gap-1 text-xs">
                          <Icon className="h-3 w-3" />
                          {sc.label}
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
  );
}
