import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Minus, Plus, Trash2, Send, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface WorkwearVariant {
  color: string;
  colorLabel: string;
  url: string;
}

interface WorkwearProduct {
  id: string;
  name: string;
  variants: WorkwearVariant[];
  sizes: string[];
  image?: string;
}

interface CartItem {
  productId: string;
  productName: string;
  color: string;
  colorLabel: string;
  size: string;
  quantity: number;
  url: string;
}

const PRODUCTS: WorkwearProduct[] = [
  {
    id: "jeansskjorta",
    name: "Jeansskjorta Dallas",
    variants: [
      { color: "blue-used", colorLabel: "Blue Used", url: "https://www.157work.com/p/jeansskjorta-dallas/blue-used/" },
    ],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
  },
  {
    id: "vast-lindas",
    name: "Väst Lindås",
    variants: [
      { color: "black", colorLabel: "Svart", url: "https://www.157work.com/p/lindas-vest/black/" },
      { color: "navy", colorLabel: "Navy", url: "https://www.157work.com/p/lindas-vest/navy/" },
    ],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
  },
  {
    id: "pilejacka-valla",
    name: "Piléjacka Valla",
    variants: [
      { color: "ivory", colorLabel: "Vit", url: "https://www.157work.com/p/pilejacka-valla/ivory/" },
      { color: "black", colorLabel: "Svart", url: "https://www.157work.com/p/pilejacka-valla/black/" },
    ],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
  },
  {
    id: "hybridjacka",
    name: "Hybridjacka WS",
    variants: [
      { color: "black", colorLabel: "Svart", url: "https://www.157work.com/p/hybridjacka-ws-hybrid-jacket/black/" },
      { color: "navy", colorLabel: "Navy", url: "https://www.157work.com/p/hybridjacka-ws-hybrid-jacket/navy/" },
    ],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
  },
];

const COLOR_DOT: Record<string, string> = {
  "blue-used": "bg-blue-500",
  black: "bg-zinc-900",
  navy: "bg-indigo-900",
  ivory: "bg-amber-50 border border-border",
};

export default function WorkwearOrder() {
  const { user, profile } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Per-product selection state
  const [selections, setSelections] = useState<Record<string, { color: string; size: string }>>({});

  const updateSelection = (productId: string, field: "color" | "size", value: string) => {
    setSelections((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value },
    }));
  };

  const addToCart = (product: WorkwearProduct) => {
    const sel = selections[product.id];
    if (!sel?.color || !sel?.size) {
      toast.error("Välj färg och storlek först");
      return;
    }
    const variant = product.variants.find((v) => v.color === sel.color);
    if (!variant) return;

    const existing = cart.findIndex(
      (c) => c.productId === product.id && c.color === sel.color && c.size === sel.size
    );
    if (existing >= 0) {
      setCart((prev) =>
        prev.map((c, i) => (i === existing ? { ...c, quantity: c.quantity + 1 } : c))
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          color: sel.color,
          colorLabel: variant.colorLabel,
          size: sel.size,
          quantity: 1,
          url: variant.url,
        },
      ]);
    }
    toast.success(`${product.name} tillagd`);
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
    setSubmitting(true);

    try {
      // Save order to database
      const { error: dbError } = await supabase.from("workwear_orders" as any).insert({
        user_id: user.id,
        items: cart,
        notes,
      } as any);
      if (dbError) throw dbError;

      // Send email via edge function
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
<h1 style="margin:0;font-size:20px;font-weight:600;color:#fff;">👔 Beställning av arbetskläder</h1>
</div>
<div style="background:#fff;padding:32px;border:1px solid #dde1e6;border-top:none;border-radius:0 0 12px 12px;">
<p style="margin:0 0 16px;font-size:15px;color:#3a4553;">
<strong>${profile?.full_name || "Anställd"}</strong> har beställt arbetskläder:
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

      // Get recipient email from org_chart_settings or fallback
      const { data: settingData } = await supabase
        .from("org_chart_settings")
        .select("setting_value")
        .eq("setting_key", "workwear_email")
        .single();

      const recipientEmail = settingData?.setting_value || (await getItEmail());

      await supabase.functions.invoke("send-email", {
        body: {
          to: recipientEmail,
          subject: `[SHF] Beställning arbetskläder – ${profile?.full_name || "Anställd"}`,
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

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2 px-4 md:px-6">
        <CardTitle className="font-heading text-base flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          Beställ arbetskläder
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 md:px-6 space-y-4">
        {/* Product list */}
        <div className="grid gap-3">
          {PRODUCTS.map((product) => {
            const sel = selections[product.id] || { color: "", size: "" };
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
                  {/* Color select */}
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

                  {/* Size select */}
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

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs"
                    onClick={() => addToCart(product)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Lägg till
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Cart */}
        {cart.length > 0 && (
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
