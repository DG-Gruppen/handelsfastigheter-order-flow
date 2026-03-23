import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useModulePermission } from "@/hooks/useModulePermission";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare } from "lucide-react";
import { Clock, CheckCircle2, XCircle, Package, Zap, LogOut, UserPlus, Search, History as HistoryIcon } from "lucide-react";
import { ORDER_STATUS_CONFIG } from "@/lib/constants";

const PAGE_SIZE = 50;

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
  const queryClient = useQueryClient();
  const [loadingMore, setLoadingMore] = useState(false);
  const [extraOrders, setExtraOrders] = useState<HistoryOrder[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const isAdmin = roles.includes("admin") || roles.includes("it");
  const isManager = roles.includes("manager");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(async (pageIndex: number) => {
    if (!user || !profile) return [];

    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let data: HistoryOrder[] = [];

    if (isAdmin) {
      const { data: rows } = await supabase
        .from("orders")
        .select("*, requester:profiles!requester_id(full_name)")
        .order("created_at", { ascending: false })
        .range(from, to);

      data = (rows ?? []).map((o: any) => ({
        ...o,
        requester_name: o.requester?.full_name ?? "Okänd",
      }));
    } else if (isManager) {
      const { data: subRows } = await supabase.rpc("get_subordinate_user_ids", {
        _manager_profile_id: profile.id,
      });
      const subordinateIds = (subRows ?? []).map((r: { user_id: string }) => r.user_id);
      const allUserIds = [...new Set([user.id, ...subordinateIds])];

      const { data: rows } = await supabase
        .from("orders")
        .select("*, requester:profiles!requester_id(full_name)")
        .in("requester_id", allUserIds)
        .order("created_at", { ascending: false })
        .range(from, to);

      data = (rows ?? []).map((o: any) => ({
        ...o,
        requester_name: o.requester?.full_name ?? "Okänd",
      }));
    } else {
      const { data: rows } = await supabase
        .from("orders")
        .select("*")
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      data = (rows ?? []).map((o) => ({ ...o, requester_name: profile.full_name }));
    }

    return data;
  }, [user, profile, isAdmin, isManager]);

  const { data: firstPageOrders = [], isLoading: loading } = useQuery({
    queryKey: ["history-orders", user?.id, isAdmin, isManager, profile?.id],
    queryFn: async () => {
      const data = await fetchPage(0);
      setHasMore(data.length === PAGE_SIZE);
      setExtraOrders([]);
      setPage(0);
      return data;
    },
    enabled: !!user && !!profile,
    staleTime: 5 * 60 * 1000,
  });

  const orders = useMemo(() => [...firstPageOrders, ...extraOrders], [firstPageOrders, extraOrders]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !profile) return;
    const channel = supabase
      .channel("history-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          setExtraOrders([]);
          setPage(0);
          queryClient.invalidateQueries({ queryKey: ["history-orders"] });
        }, 500);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [user, profile, queryClient]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    setLoadingMore(true);
    const data = await fetchPage(nextPage);
    setHasMore(data.length === PAGE_SIZE);
    setExtraOrders((prev) => [...prev, ...data]);
    setLoadingMore(false);
  };

  const filtered = useMemo(() => orders.filter(o => {
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
  }), [orders, statusFilter, search]);

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
              <>
                <div className="divide-y divide-border/50 -mx-4 md:mx-0">
                  {filtered.map((order) => {
                    const sc = ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG.pending;
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
                {hasMore && !search && statusFilter === "all" && (
                  <div className="pt-4 text-center">
                    <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
                      {loadingMore ? "Laddar..." : "Ladda fler"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
