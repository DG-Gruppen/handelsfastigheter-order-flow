import React, { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useRegions } from "@/hooks/useRegions";
import { ShoppingBag, Users, Package, MapPin, TrendingUp, CalendarClock, Download, StickyNote, Printer, ChevronDown, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { SEASON_LABELS, ALL_SEASONS, PRODUCTS_BY_SEASON, type Season } from "./workwearProducts";
import {
  SortableHeader,
  SortConfig,
  toggleSort,
  applySortString,
  parseLogoInfo,
  parseColor,
  downloadCsv,
} from "./workwearAdminHelpers";

interface OrderRow {
  id: string;
  user_id: string;
  items: any[];
  notes: string | null;
  status: string;
  created_at: string;
  season: string | null;
}

interface ProfileRow {
  user_id: string;
  full_name: string;
  department: string | null;
  region_id: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Väntande",
  submitted: "Inlämnad",
  confirmed: "Bekräftad",
  delivered: "Levererad",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  submitted: "secondary",
  confirmed: "default",
  delivered: "outline",
};

export default function WorkwearAdminPanel() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [activeSeason, setActiveSeason] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterSeason, setFilterSeason] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const { regions } = useRegions();

  // Sort states per tab
  const [sortItems, setSortItems] = useState<SortConfig | null>(null);
  const [sortRegions, setSortRegions] = useState<SortConfig | null>(null);
  const [sortOrders, setSortOrders] = useState<SortConfig | null>(null);
  const [sortSupplier, setSortSupplier] = useState<SortConfig | null>(null);
  const [sortPick, setSortPick] = useState<SortConfig | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [expandedSupplierProducts, setExpandedSupplierProducts] = useState<Set<string> | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const [ordersRes, profilesRes, seasonRes, deadlineRes] = await Promise.all([
        supabase.from("workwear_orders" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("user_id, full_name, department, region_id"),
        supabase.from("org_chart_settings").select("setting_value").eq("setting_key", "workwear_season").single(),
        supabase.from("org_chart_settings").select("setting_value").eq("setting_key", "workwear_deadline").single(),
      ]);
      setOrders((ordersRes.data as any) || []);
      setProfiles(profilesRes.data || []);
      const season = seasonRes.data?.setting_value || "";
      setActiveSeason(season);
      if (season) setFilterSeason(season);
      setDeadline(deadlineRes.data?.setting_value || "");
      setLoading(false);
    };
    load();
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("workwear_orders" as any)
      .update({ status: newStatus } as any)
      .eq("id", orderId);
    if (!error) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    }
  };

  const profileMap = useMemo(() => {
    const m = new Map<string, ProfileRow>();
    profiles.forEach((p) => m.set(p.user_id, p));
    return m;
  }, [profiles]);

  const regionMap = useMemo(() => {
    const m = new Map<string, string>();
    regions.forEach((r) => m.set(r.id, r.name));
    return m;
  }, [regions]);

  const getRegionName = (userId: string) => {
    const p = profileMap.get(userId);
    return p?.region_id ? regionMap.get(p.region_id) || "Okänd" : "Okänd";
  };

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (filterSeason !== "all") {
      result = result.filter((o) => {
        const orderSeason = (o as any).season;
        // Null-season orders (before season tracking) count toward the active season
        return orderSeason === filterSeason || (!orderSeason && filterSeason === activeSeason);
      });
    }
    if (filterRegion !== "all") {
      result = result.filter((o) => profileMap.get(o.user_id)?.region_id === filterRegion);
    }
    return result;
  }, [orders, filterSeason, filterRegion, profileMap, activeSeason]);

  // ── Item stats (Sammanställning + Beställningslista) ──
  const itemStats = useMemo(() => {
    const map = new Map<string, { name: string; color: string; size: string; qty: number; logo: string; orderers: Set<string>; regions: Set<string> }>();
    filteredOrders.forEach((o) => {
      const p = profileMap.get(o.user_id);
      const ordererName = p?.full_name || "Okänd";
      const regionName = getRegionName(o.user_id);
      const items = Array.isArray(o.items) ? o.items : [];
      items.forEach((item: any) => {
        const colorLabel = item.colorLabel || item.color || "";
        const key = `${item.productName}||${colorLabel}||${item.size}`;
        const existing = map.get(key);
        if (existing) {
          existing.qty += item.quantity || 1;
          existing.orderers.add(ordererName);
          existing.regions.add(regionName);
        } else {
          map.set(key, {
            name: item.productName || item.productId,
            color: parseColor(colorLabel),
            size: item.size || "",
            qty: item.quantity || 1,
            logo: parseLogoInfo(colorLabel),
            orderers: new Set([ordererName]),
            regions: new Set([regionName]),
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "sv") || a.color.localeCompare(b.color, "sv") || a.size.localeCompare(b.size, "sv"));
  }, [filteredOrders, profileMap, regionMap]);

  // Supplier list grouped by product
  // Build a lookup: productName+color → url from workwearProducts
  const productUrlLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    Object.values(PRODUCTS_BY_SEASON).flat().forEach((p) => {
      p.variants.forEach((v) => {
        lookup.set(`${p.name}||${v.colorLabel}`, v.url);
        lookup.set(`${p.name}||${v.color}`, v.url);
      });
    });
    return lookup;
  }, []);

  const supplierGroups = useMemo(() => {
    const groups = new Map<string, { name: string; totalQty: number; logo: string; sizes: { color: string; size: string; qty: number; logo: string; url: string }[] }>();
    itemStats.forEach((item) => {
      // Try to find URL for this product+color combo
      const url = productUrlLookup.get(`${item.name}||${item.color}`) || "";
      const existing = groups.get(item.name);
      if (existing) {
        existing.totalQty += item.qty;
        existing.sizes.push({ color: item.color, size: item.size, qty: item.qty, logo: item.logo, url });
      } else {
        groups.set(item.name, {
          name: item.name,
          totalQty: item.qty,
          logo: item.logo,
          sizes: [{ color: item.color, size: item.size, qty: item.qty, logo: item.logo, url }],
        });
      }
    });
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, "sv"));
  }, [itemStats, productUrlLookup]);

  const supplierRows = useMemo(() => {
    const sorted = applySortString(itemStats, sortSupplier);
    return { sorted };
  }, [itemStats, sortSupplier]);

  // ── Pick list ──
  const pickRows = useMemo(() => {
    const map = new Map<string, { user_id: string; region: string; name: string; product: string; color: string; size: string; qty: number }>();
    filteredOrders.forEach((o) => {
      const p = profileMap.get(o.user_id);
      const regionName = getRegionName(o.user_id);
      const items = Array.isArray(o.items) ? o.items : [];
      items.forEach((item: any) => {
        const colorLabel = item.colorLabel || item.color || "";
        const key = `${o.user_id}||${item.productName}||${colorLabel}||${item.size}`;
        const existing = map.get(key);
        if (existing) {
          existing.qty += item.quantity || 1;
        } else {
          map.set(key, {
            user_id: o.user_id,
            region: regionName,
            name: p?.full_name || "Okänd",
            product: item.productName || item.productId,
            color: parseColor(colorLabel),
            size: item.size || "",
            qty: item.quantity || 1,
          });
        }
      });
    });
    const rows = Array.from(map.values());
    if (sortPick) return applySortString(rows, sortPick);
    // Default: sort by region, then name, then product
    return rows.sort((a, b) => {
      const d = a.region.localeCompare(b.region, "sv");
      if (d !== 0) return d;
      const n = a.name.localeCompare(b.name, "sv");
      if (n !== 0) return n;
      return a.product.localeCompare(b.product, "sv");
    });
  }, [filteredOrders, profileMap, sortPick, regionMap]);

  // ── Notes per person (for plocklista) ──
  const personNotes = useMemo(() => {
    const map = new Map<string, string[]>();
    filteredOrders.forEach((o) => {
      const note = o.notes?.trim();
      if (note) {
        const existing = map.get(o.user_id) || [];
        existing.push(note);
        map.set(o.user_id, existing);
      }
    });
    return map;
  }, [filteredOrders]);

  // ── Per-department breakdown ──
  const deptStats = useMemo(() => {
    const map = new Map<string, { dept: string; count: number; items: number }>();
    filteredOrders.forEach((o) => {
      const regionName = getRegionName(o.user_id);
      const existing = map.get(regionName) || { dept: regionName, count: 0, items: 0 };
      existing.count += 1;
      const items = Array.isArray(o.items) ? o.items : [];
      existing.items += items.reduce((s: number, i: any) => s + (i.quantity || 1), 0);
      map.set(regionName, existing);
    });
    return applySortString(Array.from(map.values()), sortRegions);
  }, [filteredOrders, profileMap, sortRegions, regionMap]);

  const totalItems = useMemo(() => itemStats.reduce((s, i) => s + i.qty, 0), [itemStats]);

  // ── Orders table sorted ──
  const sortedOrders = useMemo(() => {
    const rows = filteredOrders.map((order) => {
      const p = profileMap.get(order.user_id);
      const items = Array.isArray(order.items) ? order.items : [];
      const totalQty = items.reduce((s: number, i: any) => s + (i.quantity || 1), 0);
      return {
        ...order,
        fullName: p?.full_name || "Okänd",
        region: getRegionName(order.user_id),
        totalQty,
        itemNames: items.map((i: any) => i.productName).join(", "),
      };
    });
    return applySortString(rows, sortOrders);
  }, [filteredOrders, profileMap, sortOrders]);

  const sortedItemStats = useMemo(() => applySortString(itemStats, sortItems), [itemStats, sortItems]);

  // KPI derived from filteredOrders
  const uniqueOrderers = useMemo(() => new Set(filteredOrders.map((o) => o.user_id)).size, [filteredOrders]);
  const uniqueRegions = useMemo(() => new Set(filteredOrders.map((o) => getRegionName(o.user_id)).filter((r) => r !== "Okänd")).size, [filteredOrders, profileMap, regionMap]);

  const generatePickCsv = (rows: typeof pickRows, filename: string) => {
    const csvRows: string[][] = [];
    let currentUserId = "";
    rows.forEach((r) => {
      if (r.user_id !== currentUserId) {
        currentUserId = r.user_id;
        const notes = personNotes.get(r.user_id);
        if (notes?.length) {
          csvRows.push([r.region, r.name, "📝 " + notes.join("; "), "", "", ""]);
        }
      }
      csvRows.push([r.region, r.name, r.product, r.color, r.size, String(r.qty)]);
    });
    downloadCsv(["Region", "Namn", "Plagg", "Färg", "Storlek", "Antal"], csvRows, filename);
  };

  const handlePrintPickList = (regionFilter?: string) => {
    const rows = regionFilter ? pickRows.filter((r) => r.region === regionFilter) : pickRows;
    const title = regionFilter ? `Plocklista – ${regionFilter}` : "Plocklista – Alla regioner";
    const w = window.open("", "_blank");
    if (!w) return;
    let html = `<html><head><title>${title}</title><style>
      body{font-family:system-ui,sans-serif;padding:20px;font-size:12px}
      h1{font-size:16px;margin-bottom:4px}
      .person-block{break-inside:avoid;page-break-inside:avoid;margin-bottom:12px}
      .person-block h3{font-size:13px;margin:0 0 4px;background:#f0f0f0;padding:4px 8px}
      table{width:100%;border-collapse:collapse;margin-bottom:0}
      th,td{border:1px solid #ddd;padding:4px 8px;text-align:left}
      th{background:#f5f5f5;font-weight:600}
      .note{font-size:11px;color:#666;font-style:italic;margin:2px 0 4px}
      .total-row{background:#f9f9f9;font-weight:bold}
      @media print{body{padding:0}}
    </style></head><body>`;
    html += `<h1>${title}</h1>`;
    html += `<p>${new Set(rows.map(r=>r.user_id)).size} personer · ${rows.reduce((s,r)=>s+r.qty,0)} plagg</p>`;

    let currentUser = "";
    let personItems: typeof rows = [];
    const flushUser = () => {
      if (!personItems.length) return;
      const first = personItems[0];
      const notes = personNotes.get(first.user_id);
      html += `<div class="person-block">`;
      html += `<h3>${first.name} – ${first.region}</h3>`;
      if (notes?.length) html += `<p class="note">📝 ${notes.join(" · ")}</p>`;
      html += `<table><tr><th>Plagg</th><th>Färg</th><th>Storlek</th><th>Antal</th></tr>`;
      let total = 0;
      personItems.forEach(r => {
        html += `<tr><td>${r.product}</td><td>${r.color}</td><td>${r.size}</td><td>${r.qty}</td></tr>`;
        total += r.qty;
      });
      html += `<tr class="total-row"><td colspan="3">Totalt</td><td>${total}</td></tr></table>`;
      html += `</div>`;
    };
    rows.forEach(r => {
      if (r.user_id !== currentUser) { flushUser(); currentUser = r.user_id; personItems = []; }
      personItems.push(r);
    });
    flushUser();
    html += `</body></html>`;
    w.document.write(html);
    w.document.close();
    w.print();
  };

  const handlePrintSupplierList = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    let html = `<html><head><title>Beställningslista</title><style>
      body{font-family:system-ui,sans-serif;padding:20px;font-size:12px}
      h1{font-size:16px;margin-bottom:4px}
      .product-block{break-inside:avoid;page-break-inside:avoid;margin-bottom:12px}
      .product-block h3{font-size:13px;margin:0 0 4px;background:#f0f0f0;padding:4px 8px}
      .product-block h3 a{color:#2563eb;text-decoration:none;font-size:11px;margin-left:8px;font-weight:normal}
      .product-block h3 a:hover{text-decoration:underline}
      table{width:100%;border-collapse:collapse;margin-bottom:0}
      th,td{border:1px solid #ddd;padding:4px 8px;text-align:left}
      th{background:#f5f5f5;font-weight:600}
      .total-row{background:#f9f9f9;font-weight:bold}
      a.color-link{color:#2563eb;text-decoration:none}
      a.color-link:hover{text-decoration:underline}
      @media print{body{padding:0} a{color:#000!important}}
    </style></head><body>`;
    html += `<h1>Beställningslista – Leverantörsunderlag</h1>`;
    html += `<p>${supplierGroups.length} produkter · ${totalItems} plagg totalt</p>`;
    supplierGroups.forEach((group) => {
      // Find a representative URL for the product heading
      const headingUrl = group.sizes.find(s => s.url)?.url || "";
      html += `<div class="product-block">`;
      html += `<h3>${group.name} (${group.totalQty} st)${headingUrl ? ` <a href="${headingUrl}" target="_blank">🔗 157work.com</a>` : ""}</h3>`;
      html += `<table><tr><th>Färg</th><th>Storlek</th><th>Antal</th><th>Logga</th></tr>`;
      group.sizes.forEach((s) => {
        const colorCell = s.url
          ? `<a class="color-link" href="${s.url}" target="_blank">${s.color}</a>`
          : s.color;
        html += `<tr><td>${colorCell}</td><td>${s.size}</td><td>${s.qty}</td><td>${s.logo}</td></tr>`;
      });
      html += `<tr class="total-row"><td colspan="2">Totalt</td><td>${group.totalQty}</td><td></td></tr></table>`;
      html += `</div>`;
    });
    html += `</body></html>`;
    w.document.write(html);
    w.document.close();
    w.print();
  };

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

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
        <h2 className="font-heading text-base md:text-lg font-bold text-foreground flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          Profilkläder – Översikt
        </h2>
        <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1 text-xs md:text-sm text-muted-foreground">
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
          { label: "Beställningar", value: filteredOrders.length, icon: TrendingUp, color: "text-primary" },
          { label: "Beställare", value: uniqueOrderers, icon: Users, color: "text-accent" },
          { label: "Totalt plagg", value: totalItems, icon: Package, color: "text-warning" },
          { label: "Regioner", value: uniqueRegions, icon: MapPin, color: "text-primary" },
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

      {/* Filters */}
      <div className="grid grid-cols-2 md:flex md:items-center gap-2 md:gap-3">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground hidden md:inline">Säsong:</span>
          <Select value={filterSeason} onValueChange={setFilterSeason}>
            <SelectTrigger className="w-full md:w-[160px] h-9 text-xs">
              <SelectValue placeholder="Säsong" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Alla säsonger</SelectItem>
              {ALL_SEASONS.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{SEASON_LABELS[s as Season]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground hidden md:inline">Region:</span>
          <Select value={filterRegion} onValueChange={setFilterRegion}>
            <SelectTrigger className="w-full md:w-[200px] h-9 text-xs">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Alla regioner</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="items">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="flex-wrap h-auto gap-1 w-max md:w-auto">
            <TabsTrigger value="items" className="text-xs md:text-sm">Sammanställning</TabsTrigger>
            <TabsTrigger value="supplier" className="text-xs md:text-sm">Beställningslista</TabsTrigger>
            <TabsTrigger value="pick" className="text-xs md:text-sm">Plocklista</TabsTrigger>
            <TabsTrigger value="regions" className="text-xs md:text-sm">Per region</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs md:text-sm">Beställningar</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Sammanställning ── */}
        <TabsContent value="items" className="mt-4">
          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <CardTitle className="text-xs md:text-sm font-medium">Antal per plagg, färg & storlek</CardTitle>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0" onClick={() => downloadCsv(
                ["Plagg", "Färg", "Storlek", "Antal", "Beställare", "Region"],
                sortedItemStats.map((i) => [i.name, i.color, i.size, String(i.qty), Array.from(i.orderers).join(", "), Array.from(i.regions).join(", ")]),
                "sammanstallning.csv"
              )}>
                <Download className="w-3.5 h-3.5" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {sortedItemStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Inga beställningar ännu</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader label="Plagg" sortKey="name" current={sortItems} onToggle={(k) => setSortItems(toggleSort(sortItems, k))} />
                        <SortableHeader label="Färg" sortKey="color" current={sortItems} onToggle={(k) => setSortItems(toggleSort(sortItems, k))} />
                        <SortableHeader label="Storlek" sortKey="size" current={sortItems} onToggle={(k) => setSortItems(toggleSort(sortItems, k))} />
                        <SortableHeader label="Antal" sortKey="qty" current={sortItems} onToggle={(k) => setSortItems(toggleSort(sortItems, k))} className="text-right" />
                        <TableHead>Beställare</TableHead>
                        <TableHead>Region</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedItemStats.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{item.name}</TableCell>
                          <TableCell className="text-sm">{item.color}</TableCell>
                          <TableCell className="text-sm">{item.size}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{item.qty}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px]">{Array.from(item.orderers).join(", ")}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{Array.from(item.regions).filter(r => r !== "Okänd").join(", ")}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-secondary/50 font-bold">
                        <TableCell colSpan={3} className="text-sm">Totalt</TableCell>
                        <TableCell className="text-right text-sm">{totalItems}</TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Beställningslista (leverantörsunderlag) ── */}
        <TabsContent value="supplier" className="mt-4">
          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <CardTitle className="text-xs md:text-sm font-medium">Beställningslista – Leverantörsunderlag</CardTitle>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                  const allExpanded = expandedSupplierProducts === null || (expandedSupplierProducts !== null && expandedSupplierProducts.size === supplierGroups.length);
                  if (allExpanded) {
                    setExpandedSupplierProducts(new Set());
                  } else {
                    setExpandedSupplierProducts(null);
                  }
                }}>
                  {expandedSupplierProducts === null || (expandedSupplierProducts !== null && expandedSupplierProducts.size === supplierGroups.length) ? "Dölj alla" : "Visa alla"}
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => downloadCsv(
                  ["Plagg", "Färg", "Storlek", "Antal", "Logga"],
                  supplierRows.sorted.map((i) => [i.name, i.color, i.size, String(i.qty), i.logo]),
                  "beställningslista.csv"
                )}>
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handlePrintSupplierList}>
                  <Printer className="w-3.5 h-3.5" /> Skriv ut
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {supplierGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Inga beställningar ännu</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Plagg</TableHead>
                        <TableHead>Färg</TableHead>
                        <TableHead>Storlek</TableHead>
                        <TableHead className="text-right">Antal</TableHead>
                        <TableHead>Logga</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierGroups.map((group) => {
                        const isExpanded = expandedSupplierProducts === null || (expandedSupplierProducts !== null && expandedSupplierProducts.has(group.name));
                        return (
                          <React.Fragment key={group.name}>
                            <TableRow
                              className="bg-secondary/20 hover:bg-secondary/40 cursor-pointer transition-colors"
                              onClick={() => {
                                setExpandedSupplierProducts((prev) => {
                                  if (prev === null) {
                                    const next = new Set(supplierGroups.map(g => g.name));
                                    next.delete(group.name);
                                    return next;
                                  }
                                  const next = new Set(prev);
                                  if (next.has(group.name)) next.delete(group.name); else next.add(group.name);
                                  return next;
                                });
                              }}
                            >
                              <TableCell className="w-8 px-2">
                                {isExpanded
                                  ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                              </TableCell>
                              <TableCell className="font-semibold text-sm">{group.name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{group.sizes.length} variant{group.sizes.length !== 1 ? "er" : ""}</TableCell>
                              <TableCell />
                              <TableCell className="text-right font-bold text-sm text-primary">{group.totalQty}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{group.logo}</TableCell>
                            </TableRow>
                            {isExpanded && group.sizes.map((s, si) => (
                              <TableRow key={`${group.name}-${si}`} className="bg-background">
                                <TableCell />
                                <TableCell className="text-sm text-muted-foreground pl-6">↳</TableCell>
                                <TableCell className="text-sm">{s.color}</TableCell>
                                <TableCell className="text-sm">{s.size}</TableCell>
                                <TableCell className="text-right font-medium text-sm">{s.qty}</TableCell>
                                <TableCell className="text-sm">{s.logo}</TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        );
                      })}
                      <TableRow className="bg-secondary/50 font-bold">
                        <TableCell />
                        <TableCell colSpan={3} className="text-sm">Totalt</TableCell>
                        <TableCell className="text-right text-sm">{totalItems}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Plocklista ── */}
        <TabsContent value="pick" className="mt-4">
          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <CardTitle className="text-xs md:text-sm font-medium">
                Plocklista ({new Set(pickRows.map((r) => r.user_id)).size} pers · {pickRows.reduce((s, r) => s + r.qty, 0)} plagg)
              </CardTitle>
              <div className="flex items-center gap-2 shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                      <Download className="w-3.5 h-3.5" /> CSV <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => generatePickCsv(pickRows, "plocklista-alla.csv")}>
                      Alla regioner
                    </DropdownMenuItem>
                    {regions.map((r) => (
                      <DropdownMenuItem key={r.id} onClick={() => generatePickCsv(pickRows.filter((row) => row.region === r.name), `plocklista-${r.name.toLowerCase().replace(/\//g, "-")}.csv`)}>
                        {r.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                      <Printer className="w-3.5 h-3.5" /> Skriv ut <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handlePrintPickList()}>
                      Alla regioner
                    </DropdownMenuItem>
                    {regions.map((r) => (
                      <DropdownMenuItem key={r.id} onClick={() => handlePrintPickList(r.name)}>
                        {r.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {pickRows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Inga beställningar ännu</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader label="Region" sortKey="region" current={sortPick} onToggle={(k) => setSortPick(toggleSort(sortPick, k))} />
                        <SortableHeader label="Namn" sortKey="name" current={sortPick} onToggle={(k) => setSortPick(toggleSort(sortPick, k))} />
                        <SortableHeader label="Plagg" sortKey="product" current={sortPick} onToggle={(k) => setSortPick(toggleSort(sortPick, k))} />
                        <SortableHeader label="Färg" sortKey="color" current={sortPick} onToggle={(k) => setSortPick(toggleSort(sortPick, k))} />
                        <SortableHeader label="Storlek" sortKey="size" current={sortPick} onToggle={(k) => setSortPick(toggleSort(sortPick, k))} />
                        <SortableHeader label="Antal" sortKey="qty" current={sortPick} onToggle={(k) => setSortPick(toggleSort(sortPick, k))} className="text-right" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const rows: React.ReactNode[] = [];
                        let currentRegion = "";
                        let currentUserId = "";
                        let personQty = 0;
                        let regionQty = 0;
                        let regionPersons = 0;

                        const flushPerson = (userId: string) => {
                          if (userId) {
                            rows.push(
                              <TableRow key={`person-total-${userId}`} className="bg-primary/5">
                                <TableCell colSpan={5} className="text-xs font-semibold text-muted-foreground italic pl-8">
                                  Totalt
                                </TableCell>
                                <TableCell className="text-right text-xs font-bold text-primary">{personQty} plagg</TableCell>
                              </TableRow>
                            );
                          }
                        };

                        const flushRegion = (regionName: string) => {
                          if (regionName) {
                            rows.push(
                              <TableRow key={`region-total-${regionName}`} className="bg-accent/10 border-b-2 border-accent/20">
                                <TableCell colSpan={5} className="text-xs font-bold text-accent pl-4">
                                  Totalt {regionName} ({regionPersons} pers)
                                </TableCell>
                                <TableCell className="text-right text-xs font-bold text-accent">{regionQty} plagg</TableCell>
                              </TableRow>
                            );
                          }
                        };

                        pickRows.forEach((row, i) => {
                          // Region header
                          if (row.region !== currentRegion) {
                            flushPerson(currentUserId);
                            flushRegion(currentRegion);
                            currentRegion = row.region;
                            currentUserId = "";
                            personQty = 0;
                            regionQty = 0;
                            regionPersons = 0;

                            rows.push(
                              <TableRow key={`region-header-${row.region}`} className="bg-primary/10 border-t-4 border-primary/20">
                                <TableCell colSpan={6} className="py-3">
                                  <span className="font-bold text-sm text-primary flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    {row.region}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          }

                          if (row.user_id !== currentUserId) {
                            flushPerson(currentUserId);
                            currentUserId = row.user_id;
                            personQty = 0;
                            regionPersons += 1;

                            const notes = personNotes.get(row.user_id);
                            rows.push(
                              <TableRow key={`person-header-${row.user_id}`} className="bg-secondary/60 border-t-2 border-border">
                                <TableCell className="py-2" />
                                <TableCell colSpan={4} className="py-2">
                                  <span className="font-semibold text-sm text-foreground">{row.name}</span>
                                  {notes?.length ? (
                                    <span className="ml-3 text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <StickyNote className="w-3 h-3 inline" />
                                      {notes.join(" · ")}
                                    </span>
                                  ) : null}
                                </TableCell>
                                <TableCell />
                              </TableRow>
                            );
                          }

                          personQty += row.qty;
                          regionQty += row.qty;

                          rows.push(
                            <TableRow key={i} className="hover:bg-muted/30">
                              <TableCell className="pl-8" />
                              <TableCell className="pl-8" />
                              <TableCell className="font-medium text-sm">{row.product}</TableCell>
                              <TableCell className="text-sm">{row.color}</TableCell>
                              <TableCell className="text-sm">{row.size}</TableCell>
                              <TableCell className="text-right font-semibold text-sm">{row.qty}</TableCell>
                            </TableRow>
                          );
                        });

                        flushPerson(currentUserId);
                        flushRegion(currentRegion);

                        return rows;
                      })()}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Per region ── */}
        <TabsContent value="regions" className="mt-4">
          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <CardTitle className="text-xs md:text-sm font-medium">Beställningar per region</CardTitle>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0" onClick={() => downloadCsv(
                ["Region", "Beställningar", "Antal plagg"],
                deptStats.map((d) => [d.dept, String(d.count), String(d.items)]),
                "per-region.csv"
              )}>
                <Download className="w-3.5 h-3.5" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {deptStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Inga beställningar ännu</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader label="Region" sortKey="dept" current={sortRegions} onToggle={(k) => setSortRegions(toggleSort(sortRegions, k))} />
                      <SortableHeader label="Beställningar" sortKey="count" current={sortRegions} onToggle={(k) => setSortRegions(toggleSort(sortRegions, k))} className="text-right" />
                      <SortableHeader label="Antal plagg" sortKey="items" current={sortRegions} onToggle={(k) => setSortRegions(toggleSort(sortRegions, k))} className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deptStats.map((data) => (
                      <TableRow key={data.dept}>
                        <TableCell className="font-medium text-sm">{data.dept}</TableCell>
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

        {/* ── Individual orders ── */}
        <TabsContent value="orders" className="mt-4">
          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <CardTitle className="text-xs md:text-sm font-medium">Alla beställningar ({filteredOrders.length})</CardTitle>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0" onClick={() => downloadCsv(
                ["Namn", "Region", "Plagg", "Antal", "Anteckning", "Datum", "Status"],
                sortedOrders.map((o) => [
                  o.fullName,
                  o.region,
                  o.itemNames,
                  String(o.totalQty),
                  o.notes || "",
                  format(parseISO(o.created_at), "yyyy-MM-dd"),
                  STATUS_LABEL[o.status] || o.status,
                ]),
                "beställningar.csv"
              )}>
                <Download className="w-3.5 h-3.5" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {sortedOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Inga beställningar ännu</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader label="Namn" sortKey="fullName" current={sortOrders} onToggle={(k) => setSortOrders(toggleSort(sortOrders, k))} />
                        <SortableHeader label="Region" sortKey="region" current={sortOrders} onToggle={(k) => setSortOrders(toggleSort(sortOrders, k))} className="hidden md:table-cell" />
                        <SortableHeader label="Plagg" sortKey="totalQty" current={sortOrders} onToggle={(k) => setSortOrders(toggleSort(sortOrders, k))} />
                        <SortableHeader label="Datum" sortKey="created_at" current={sortOrders} onToggle={(k) => setSortOrders(toggleSort(sortOrders, k))} className="hidden md:table-cell" />
                        <TableHead className="min-w-[120px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedOrders.map((order) => {
                        const isExpanded = expandedOrders.has(order.id);
                        const orderItems = Array.isArray(order.items) ? order.items : [];
                        return (
                          <React.Fragment key={order.id}>
                            <TableRow className="cursor-pointer" onClick={() => toggleOrderExpanded(order.id)}>
                              <TableCell className="font-medium text-sm">
                                <span className="inline-flex items-center gap-1">
                                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                                  {order.fullName}
                                </span>
                                {order.notes && (
                                  <span className="block text-xs text-muted-foreground mt-0.5 flex items-center gap-1 ml-5">
                                    <StickyNote className="w-3 h-3 inline" /> {order.notes}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground hidden md:table-cell">{order.region}</TableCell>
                              <TableCell className="text-sm">
                                {order.totalQty} plagg
                                <span className="text-muted-foreground ml-1 text-xs hidden sm:inline">({order.itemNames})</span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                                {format(parseISO(order.created_at), "d MMM yyyy", { locale: sv })}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Select value={order.status} onValueChange={(v) => updateOrderStatus(order.id, v)}>
                                  <SelectTrigger className="h-7 text-xs w-[130px]">
                                    <SelectValue>
                                      <Badge variant={STATUS_VARIANT[order.status] || "secondary"} className="text-xs">
                                        {STATUS_LABEL[order.status] || order.status}
                                      </Badge>
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending" className="text-xs">Väntande</SelectItem>
                                    <SelectItem value="confirmed" className="text-xs">Bekräftad</SelectItem>
                                    <SelectItem value="delivered" className="text-xs">Levererad</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                            {isExpanded && orderItems.length > 0 && (
                              <TableRow className="bg-muted/30">
                                <TableCell colSpan={5} className="py-2 px-3 md:pl-10">
                                  <div className="grid grid-cols-4 gap-x-2 md:gap-x-4 gap-y-1 text-xs">
                                    <span className="font-semibold text-muted-foreground">Produkt</span>
                                    <span className="font-semibold text-muted-foreground">Färg</span>
                                    <span className="font-semibold text-muted-foreground">Storlek</span>
                                    <span className="font-semibold text-muted-foreground">Antal</span>
                                    {orderItems.map((item: any, idx: number) => (
                                      <React.Fragment key={idx}>
                                        <span>{item.productName || item.productId}</span>
                                        <span>{parseColor(item.colorLabel || item.color || "")}</span>
                                        <span>{item.size || "–"}</span>
                                        <span>{item.quantity || 1}</span>
                                      </React.Fragment>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
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
