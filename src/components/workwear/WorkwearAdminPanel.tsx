import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Users, Package, MapPin, TrendingUp, CalendarClock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { SEASON_LABELS, ALL_SEASONS, type Season } from "./workwearProducts";

interface OrderRow {
  id: string;
  user_id: string;
  items: any[];
  notes: string | null;
  status: string;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  full_name: string;
  department: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Väntande",
  confirmed: "Bekräftad",
  delivered: "Levererad",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  confirmed: "default",
  delivered: "outline",
};

export default function WorkwearAdminPanel() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [activeSeason, setActiveSeason] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [ordersRes, profilesRes, seasonRes, deadlineRes] = await Promise.all([
        supabase.from("workwear_orders" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("user_id, full_name, department"),
        supabase.from("org_chart_settings").select("setting_value").eq("setting_key", "workwear_season").single(),
        supabase.from("org_chart_settings").select("setting_value").eq("setting_key", "workwear_deadline").single(),
      ]);
      setOrders((ordersRes.data as any) || []);
      setProfiles(profilesRes.data || []);
      setActiveSeason(seasonRes.data?.setting_value || "");
      setDeadline(deadlineRes.data?.setting_value || "");
      setLoading(false);
    };
    load();
  }, []);

  const profileMap = useMemo(() => {
    const m = new Map<string, ProfileRow>();
    profiles.forEach((p) => m.set(p.user_id, p));
    return m;
  }, [profiles]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p) => { if (p.department) set.add(p.department); });
    return Array.from(set).sort();
  }, [profiles]);

  const filteredOrders = useMemo(() => {
    if (filterDept === "all") return orders;
    return orders.filter((o) => profileMap.get(o.user_id)?.department === filterDept);
  }, [orders, filterDept, profileMap]);

  // Aggregate items across all filtered orders
  const itemStats = useMemo(() => {
    const map = new Map<string, { name: string; color: string; size: string; qty: number }>();
    filteredOrders.forEach((o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      items.forEach((item: any) => {
        const key = `${item.productName}||${item.colorLabel}||${item.size}`;
        const existing = map.get(key);
        if (existing) {
          existing.qty += item.quantity || 1;
        } else {
          map.set(key, {
            name: item.productName || item.productId,
            color: item.colorLabel || item.color || "",
            size: item.size || "",
            qty: item.quantity || 1,
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name) || a.color.localeCompare(b.color) || a.size.localeCompare(b.size));
  }, [filteredOrders]);

  // Per-department breakdown
  const deptStats = useMemo(() => {
    const map = new Map<string, { count: number; items: number }>();
    orders.forEach((o) => {
      const dept = profileMap.get(o.user_id)?.department || "Okänd";
      const existing = map.get(dept) || { count: 0, items: 0 };
      existing.count += 1;
      const items = Array.isArray(o.items) ? o.items : [];
      existing.items += items.reduce((s: number, i: any) => s + (i.quantity || 1), 0);
      map.set(dept, existing);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].items - a[1].items);
  }, [orders, profileMap]);

  const totalItems = useMemo(() =>
    itemStats.reduce((s, i) => s + i.qty, 0),
  [itemStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          Profilkläder – Översikt
        </h2>
        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          {activeSeason && (
            <span>Aktiv säsong: <Badge variant="secondary" className="text-xs ml-1">{SEASON_LABELS[activeSeason as Season] || activeSeason}</Badge></span>
          )}
          {deadline && (
            <span className="flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5" />
              Deadline: {format(parseISO(deadline), "d MMM yyyy", { locale: sv })}
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Beställningar", value: orders.length, icon: TrendingUp, color: "text-primary" },
          { label: "Beställare", value: new Set(orders.map((o) => o.user_id)).size, icon: Users, color: "text-accent" },
          { label: "Totalt plagg", value: totalItems, icon: Package, color: "text-warning" },
          { label: "Regioner", value: departments.length, icon: MapPin, color: "text-primary" },
        ].map((kpi) => (
          <Card key={kpi.label} className="glass-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-secondary ${kpi.color}`}>
                <kpi.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filtrera region:</span>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-[200px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Alla regioner</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Sammanställning</TabsTrigger>
          <TabsTrigger value="regions">Per region</TabsTrigger>
          <TabsTrigger value="orders">Beställningar</TabsTrigger>
        </TabsList>

        {/* Items summary */}
        <TabsContent value="items" className="mt-4">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Antal per plagg, färg & storlek</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {itemStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Inga beställningar ännu</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plagg</TableHead>
                        <TableHead>Färg</TableHead>
                        <TableHead>Storlek</TableHead>
                        <TableHead className="text-right">Antal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemStats.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{item.name}</TableCell>
                          <TableCell className="text-sm">{item.color}</TableCell>
                          <TableCell className="text-sm">{item.size}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{item.qty}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-secondary/50 font-bold">
                        <TableCell colSpan={3} className="text-sm">Totalt</TableCell>
                        <TableCell className="text-right text-sm">{totalItems}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Per region */}
        <TabsContent value="regions" className="mt-4">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Beställningar per region</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {deptStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Inga beställningar ännu</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Region / Avdelning</TableHead>
                      <TableHead className="text-right">Beställningar</TableHead>
                      <TableHead className="text-right">Antal plagg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deptStats.map(([dept, data]) => (
                      <TableRow key={dept}>
                        <TableCell className="font-medium text-sm">{dept}</TableCell>
                        <TableCell className="text-right text-sm">{data.count}</TableCell>
                        <TableCell className="text-right font-semibold text-sm">{data.items}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Individual orders */}
        <TabsContent value="orders" className="mt-4">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Alla beställningar ({filteredOrders.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Inga beställningar ännu</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Namn</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>Plagg</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => {
                        const p = profileMap.get(order.user_id);
                        const items = Array.isArray(order.items) ? order.items : [];
                        const totalQty = items.reduce((s: number, i: any) => s + (i.quantity || 1), 0);
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium text-sm">{p?.full_name || "Okänd"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{p?.department || "–"}</TableCell>
                            <TableCell className="text-sm">
                              {totalQty} plagg
                              <span className="text-muted-foreground ml-1 text-xs">
                                ({items.map((i: any) => i.productName).join(", ")})
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(parseISO(order.created_at), "d MMM yyyy", { locale: sv })}
                            </TableCell>
                            <TableCell>
                              <Badge variant={STATUS_VARIANT[order.status] || "secondary"} className="text-xs">
                                {STATUS_LABEL[order.status] || order.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
