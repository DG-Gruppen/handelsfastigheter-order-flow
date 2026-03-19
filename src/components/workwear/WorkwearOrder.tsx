import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingBag, Minus, Plus, Trash2, Send, ExternalLink, Settings2, CalendarClock, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useModulePermission } from "@/hooks/useModulePermission";
import { toast } from "sonner";
import { format, isPast, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import {
  type WorkwearProduct,
  type Season,
  PRODUCTS_BY_SEASON,
  SEASON_LABELS,
  ALL_SEASONS,
  COLOR_DOT,
} from "./workwearProducts";

interface CartItem {
  productId: string;
  productName: string;
  color: string;
  colorLabel: string;
  size: string;
  quantity: number;
  url: string;
}

export default function WorkwearOrder() {
  const { user, profile } = useAuth();
  const { canEdit, isOwner } = useModulePermission("workwear");
  const canManageSeason = canEdit || isOwner;

  const [activeSeason, setActiveSeason] = useState<Season>("sommar");
  const [deadline, setDeadline] = useState<string>("");
  const [newSeason, setNewSeason] = useState<Season>("sommar");
  const [newDeadline, setNewDeadline] = useState<string>("");
  const [loadingSeason, setLoadingSeason] = useState(true);
  const [activating, setActivating] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selections, setSelections] = useState<Record<string, { color: string; size: string; qty: number }>>({});

  // Fetch active season + deadline
  useEffect(() => {
    Promise.all([
      supabase.from("org_chart_settings").select("setting_value").eq("setting_key", "workwear_season").single(),
      supabase.from("org_chart_settings").select("setting_value").eq("setting_key", "workwear_deadline").single(),
    ]).then(([seasonRes, deadlineRes]) => {
      const s = seasonRes.data?.setting_value;
      if (s && ALL_SEASONS.includes(s as Season)) {
        setActiveSeason(s as Season);
        setNewSeason(s as Season);
      }
      if (deadlineRes.data?.setting_value) {
        setDeadline(deadlineRes.data.setting_value);
      }
      setLoadingSeason(false);
    });
  }, []);

  const products = PRODUCTS_BY_SEASON[activeSeason] || [];
  const isExpired = deadline ? isPast(parseISO(deadline)) : false;

  const upsertSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from("org_chart_settings")
      .update({ setting_value: value })
      .eq("setting_key", key);
    if (error) {
      await supabase.from("org_chart_settings").insert({ setting_key: key, setting_value: value });
    }
  };

  const handleActivateSeason = async () => {
    if (!newDeadline) {
      toast.error("Ange ett slutdatum för beställningsrundan");
      return;
    }
    setActivating(true);
    try {
      await upsertSetting("workwear_season", newSeason);
      await upsertSetting("workwear_deadline", newDeadline);

      // Send notifications to all users
      await supabase.functions.invoke("notify-workwear-season", {
        body: {
          season_label: SEASON_LABELS[newSeason],
          deadline: newDeadline,
        },
      });

      setActiveSeason(newSeason);
      setDeadline(newDeadline);
      setCart([]);
      setSelections({});
      toast.success(`${SEASON_LABELS[newSeason]} är nu aktiv – notiser skickade till alla medarbetare!`);
    } catch (err) {
      console.error("Activate season error:", err);
      toast.error("Kunde inte aktivera säsongen");
    } finally {
      setActivating(false);
    }
  };

  const updateSelection = (productId: string, field: "color" | "size" | "qty", value: string | number) => {
    setSelections((prev) => ({
      ...prev,
      [productId]: { color: "", size: "", qty: 1, ...prev[productId], [field]: value },
    }));
  };

  const addToCart = (product: WorkwearProduct) => {
    if (isExpired) {
      toast.error("Beställningsperioden har gått ut");
      return;
    }
    const sel = selections[product.id] || { color: "", size: "", qty: 1 };
    const color = product.variants.length === 1 ? product.variants[0].color : sel.color;
    if (!color || !sel.size) {
      toast.error("Välj storlek först");
      return;
    }
    const variant = product.variants.find((v) => v.color === color);
    if (!variant) return;
    const qty = sel.qty || 1;

    const existing = cart.findIndex(
      (c) => c.productId === product.id && c.color === color && c.size === sel.size
    );
    if (existing >= 0) {
      setCart((prev) =>
        prev.map((c, i) => (i === existing ? { ...c, quantity: c.quantity + qty } : c))
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          color,
          colorLabel: variant.colorLabel,
          size: sel.size,
          quantity: qty,
          url: variant.url,
        },
      ]);
    }
    toast.success(`${product.name} × ${qty} tillagd`);
  };

  const updateQty = (index: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((c, i) => (i === index ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user || cart.length === 0) return;
    if (isExpired) {
      toast.error("Beställningsperioden har gått ut");
      return;
    }
    setSubmitting(true);

    try {
      const { error: dbError } = await supabase.from("workwear_orders" as any).insert({
        user_id: user.id,
        items: cart,
        notes,
      } as any);
      if (dbError) throw dbError;

      const itemsHtml = cart
        .map(
          (c) =>
            `<tr><td style="padding:8px 12px;border-bottom:1px solid #dde1e6;font-size:14px;">${c.productName}</td><td style="padding:8px 12px;border-bottom:1px solid #dde1e6;font-size:14px;">${c.colorLabel}</td><td style="padding:8px 12px;border-bottom:1px solid #dde1e6;font-size:14px;">${c.size}</td><td style="padding:8px 12px;border-bottom:1px solid #dde1e6;font-size:14px;text-align:center;">${c.quantity}</td><td style="padding:8px 12px;border-bottom:1px solid #dde1e6;font-size:14px;"><a href="${c.url}" style="color:#2e4a62;">Länk</a></td></tr>`
        )
        .join("");

      const html = `<!DOCTYPE html>
<html lang="sv"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Roboto','Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
<div style="background:linear-gradient(135deg,#2e4a62 0%,#3a5f7c 100%);padding:28px 32px;border-radius:12px 12px 0 0;">
<h1 style="margin:0;font-size:20px;font-weight:600;color:#fff;">👔 Beställning av profilkläder</h1>
</div>
<div style="background:#fff;padding:32px;border:1px solid #dde1e6;border-top:none;border-radius:0 0 12px 12px;">
<p style="margin:0 0 16px;font-size:15px;color:#3a4553;">
<strong>${profile?.full_name || "Anställd"}</strong> har beställt profilkläder (${SEASON_LABELS[activeSeason]}):
</p>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;border:1px solid #dde1e6;border-radius:8px;overflow:hidden;">
<tr style="background:#f4f5f7;">
<th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7685;text-transform:uppercase;">Plagg</th>
<th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7685;text-transform:uppercase;">Färg</th>
<th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7685;text-transform:uppercase;">Storlek</th>
<th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7685;text-transform:uppercase;">Antal</th>
<th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7685;text-transform:uppercase;">Produkt</th>
</tr>
${itemsHtml}
</table>
${notes ? `<p style="margin:16px 0 0;font-size:14px;color:#3a4553;"><strong>Kommentar:</strong> ${notes}</p>` : ""}
<p style="margin:16px 0 0;font-size:13px;color:#6b7685;">E-post: ${profile?.email || user.email}</p>
</div>
<div style="padding:24px 16px;text-align:center;">
<p style="margin:0;font-size:11px;color:#6b7685;">SHF Intra · Svensk Handelsfastigheter</p>
</div>
</div>
</body></html>`;

      const { data: settingData } = await supabase
        .from("org_chart_settings")
        .select("setting_value")
        .eq("setting_key", "workwear_email")
        .single();

      const recipientEmail = settingData?.setting_value || (await getItEmail());

      await supabase.functions.invoke("send-email", {
        body: {
          to: recipientEmail,
          subject: `[SHF] Beställning profilkläder – ${profile?.full_name || "Anställd"}`,
          html,
          reply_to: profile?.email || user.email,
        },
      });

      toast.success("Beställningen har skickats!");
      setCart([]);
      setNotes("");
      setSelections({});
    } catch (err) {
      console.error("Workwear order error:", err);
      toast.error("Kunde inte skicka beställningen");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingSeason) return null;

  return (
    <Card className="glass-card border-primary/15 shadow-lg">
      <CardHeader className="pb-3 px-4 md:px-6 border-b border-border/50 bg-gradient-to-r from-primary/[0.03] to-transparent">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <ShoppingBag className="w-4 h-4 text-primary" />
            </span>
            Beställ profilkläder
            <Badge className="ml-1 text-xs font-normal bg-accent text-accent-foreground border-0">
              {SEASON_LABELS[activeSeason]}
            </Badge>
          </CardTitle>

          {deadline && (
            <div className="flex items-center gap-1.5 text-xs">
              <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
              {isExpired ? (
                <Badge variant="destructive" className="text-xs font-medium">
                  Beställningsperioden avslutad
                </Badge>
              ) : (
                <span className="text-muted-foreground">
                  Sista dag:{" "}
                  <span className="font-semibold text-primary">
                    {format(parseISO(deadline), "d MMMM yyyy", { locale: sv })}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 md:px-6 space-y-4">
        {/* Admin: activate season */}
        {canManageSeason && (
          <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Settings2 className="w-4 h-4" />
              Starta ny beställningsrunda
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Säsong</Label>
                <Select value={newSeason} onValueChange={(v) => setNewSeason(v as Season)}>
                  <SelectTrigger className="w-[140px] h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_SEASONS.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {SEASON_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Sista beställningsdag</Label>
                <Input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-[170px] h-9 text-xs"
                />
              </div>
              <div className="flex items-end">
                <Button
                  size="sm"
                  className="h-9 text-xs"
                  onClick={handleActivateSeason}
                  disabled={activating}
                >
                  <Rocket className="w-3.5 h-3.5 mr-1.5" />
                  {activating ? "Aktiverar..." : "Aktivera & notifiera"}
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Alla medarbetare får en notis om att beställningsrundan öppnat.
            </p>
          </div>
        )}

        {isExpired && !canManageSeason ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Beställningsperioden har avslutats</p>
            <p className="text-xs mt-1">Nästa beställningsrunda öppnar snart.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Inga plagg tillgängliga för {SEASON_LABELS[activeSeason]}</p>
            <p className="text-xs mt-1">Sortimentet uppdateras snart.</p>
          </div>
        ) : (
          <Tabs defaultValue="herr">
            <TabsList className="w-full bg-primary/5 border border-primary/10">
              <TabsTrigger value="herr" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Herr</TabsTrigger>
              <TabsTrigger value="dam" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Dam</TabsTrigger>
            </TabsList>
            {(["herr", "dam"] as const).map((gender) => (
              <TabsContent key={gender} value={gender} className="mt-3">
                <div className="grid gap-3">
                  {products.filter((p) => p.gender === gender).map((product) => {
                    const sel = selections[product.id] || { color: "", size: "", qty: 1 };
                    return (
                      <div
                        key={product.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-secondary/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{product.name}</p>
                          <div className="flex items-center gap-1 mt-1">
                            {product.variants.map((v) => (
                              <a
                                key={v.color}
                                href={v.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-0.5"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                {v.colorLabel}
                              </a>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {product.variants.length > 1 ? (
                            <Select
                              value={sel.color}
                              onValueChange={(v) => updateSelection(product.id, "color", v)}
                            >
                              <SelectTrigger className="w-[110px] h-9 text-xs">
                                <SelectValue placeholder="Färg" />
                              </SelectTrigger>
                              <SelectContent>
                                {product.variants.map((v) => (
                                  <SelectItem key={v.color} value={v.color} className="text-xs">
                                    <span className="flex items-center gap-1.5">
                                      <span className={`w-2.5 h-2.5 rounded-full ${COLOR_DOT[v.color] || "bg-muted"}`} />
                                      {v.colorLabel}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="h-9 px-3 text-xs font-normal flex items-center gap-1.5">
                              <span className={`w-2.5 h-2.5 rounded-full ${COLOR_DOT[product.variants[0].color] || "bg-muted"}`} />
                              {product.variants[0].colorLabel}
                            </Badge>
                          )}

                          <Select
                            value={sel.size}
                            onValueChange={(v) => updateSelection(product.id, "size", v)}
                          >
                            <SelectTrigger className="w-[80px] h-9 text-xs">
                              <SelectValue placeholder="Stl" />
                            </SelectTrigger>
                            <SelectContent>
                              {product.sizes.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateSelection(product.id, "qty", Math.max(1, (sel.qty || 1) - 1))}>
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Badge variant="secondary" className="min-w-[24px] justify-center text-xs">
                              {sel.qty || 1}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateSelection(product.id, "qty", (sel.qty || 1) + 1)}>
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 text-xs"
                            onClick={() => addToCart(product)}
                            disabled={isExpired}
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Lägg till
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Cart */}
        {cart.length > 0 && !isExpired && (
          <div className="space-y-3 pt-2 border-t border-border">
            <h4 className="text-sm font-semibold text-foreground">Din varukorg</h4>
            {cart.map((item, i) => (
              <div key={`${item.productId}-${item.color}-${item.size}`} className="flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{item.productName}</span>
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    {item.colorLabel} · {item.size}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQty(i, -1)}>
                    <Minus className="w-3 h-3" />
                  </Button>
                  <Badge variant="secondary" className="min-w-[24px] justify-center">
                    {item.quantity}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQty(i, 1)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}

            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Kommentar (valfritt)..."
              className="text-sm"
              rows={2}
            />

            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              <Send className="w-4 h-4 mr-2" />
              {submitting ? "Skickar..." : "Skicka beställning"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function getItEmail(): Promise<string> {
  const { data } = await supabase
    .from("org_chart_settings")
    .select("setting_value")
    .eq("setting_key", "it_contact_email")
    .single();
  return data?.setting_value || "helpdesk@dggruppen.se";
}
