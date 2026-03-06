import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Plus, Trash2 } from "lucide-react";
import { getIcon } from "@/lib/icons";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface OrderType {
  id: string;
  name: string;
  category_id: string | null;
  description: string;
  icon: string;
}

interface ProfileOption {
  id: string;
  user_id: string;
  full_name: string;
}

interface OrderItem {
  typeId: string;
  quantity: number;
}

export default function NewOrder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [managers, setManagers] = useState<ProfileOption[]>([]);
  const [items, setItems] = useState<OrderItem[]>([{ typeId: "", quantity: 1 }]);
  const [approverId, setApproverId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [catsRes, typesRes, profilesRes, rolesRes] = await Promise.all([
        supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("order_types").select("*").eq("is_active", true).order("name"),
        supabase.from("profiles").select("id, user_id, full_name").neq("user_id", user?.id ?? ""),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      setCategories((catsRes.data as Category[]) ?? []);
      setOrderTypes((typesRes.data as OrderType[]) ?? []);

      const managerUserIds = new Set(
        (rolesRes.data ?? [])
          .filter((r: any) => r.role === "manager" || r.role === "admin")
          .map((r: any) => r.user_id)
      );
      const filteredManagers = ((profilesRes.data as ProfileOption[]) ?? []).filter(
        (p) => managerUserIds.has(p.user_id)
      );
      setManagers(filteredManagers);
    };
    if (user) fetchData();
  }, [user]);

  const addItem = () => {
    setItems((prev) => [...prev, { typeId: "", quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.typeId);
    if (!user || validItems.length === 0 || !approverId) {
      toast.error("Lägg till minst en utrustning och välj godkännare");
      return;
    }
    setSubmitting(true);

    const manager = managers.find((m) => m.id === approverId);
    const firstType = orderTypes.find((t) => t.id === validItems[0].typeId);

    const title =
      validItems.length === 1
        ? firstType?.name ?? "Beställning"
        : `${firstType?.name ?? "Beställning"} + ${validItems.length - 1} till`;

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        requester_id: user.id,
        approver_id: manager?.user_id ?? null,
        order_type_id: validItems[0].typeId,
        category_id: firstType?.category_id ?? null,
        title,
        description: description.trim(),
      } as any)
      .select("id")
      .single();

    if (error || !order) {
      toast.error("Kunde inte skapa beställningen");
      console.error(error);
      setSubmitting(false);
      return;
    }

    const orderItemsToInsert = validItems.map((it) => {
      const ot = orderTypes.find((t) => t.id === it.typeId);
      return {
        order_id: order.id,
        order_type_id: it.typeId,
        category_id: ot?.category_id ?? null,
        name: ot?.name ?? "",
        description: ot?.description ?? "",
        quantity: it.quantity,
      };
    });

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsToInsert as any);

    if (itemsError) {
      console.error("Could not insert order items:", itemsError);
    }

    toast.success("Beställningen har skickats till din chef för godkännande!");
    navigate("/dashboard");
    setSubmitting(false);
  };

  const grouped = categories
    .map((cat) => ({
      category: cat,
      types: orderTypes.filter((ot) => ot.category_id === cat.id),
    }))
    .filter((g) => g.types.length > 0);

  const uncategorized = orderTypes.filter(
    (ot) => !ot.category_id || !categories.some((c) => c.id === ot.category_id)
  );

  const renderTypeSelect = (item: OrderItem, index: number) => (
    <Select value={item.typeId} onValueChange={(v) => updateItem(index, "typeId", v)}>
      <SelectTrigger className="h-12 md:h-10 flex-1">
        <SelectValue placeholder="Välj utrustning..." />
      </SelectTrigger>
      <SelectContent>
        {grouped.map(({ category, types }) => {
          const CatIcon = getIcon(category.icon);
          return (
            <div key={category.id}>
              <div className="px-2 py-2 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <CatIcon className="h-3.5 w-3.5" />
                {category.name}
              </div>
              {types.map((t) => (
                <SelectItem key={t.id} value={t.id} className="py-3 md:py-2">
                  {t.name}
                </SelectItem>
              ))}
            </div>
          );
        })}
        {uncategorized.length > 0 && (
          <div>
            <div className="px-2 py-2 text-xs font-semibold text-muted-foreground">
              Övrigt
            </div>
            {uncategorized.map((t) => (
              <SelectItem key={t.id} value={t.id} className="py-3 md:py-2">
                {t.name}
              </SelectItem>
            ))}
          </div>
        )}
      </SelectContent>
    </Select>
  );

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto animate-fade-up">
        <Card className="glass-card shadow-xl shadow-primary/[0.03]">
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="font-heading text-lg md:text-xl">Ny beställning</CardTitle>
            <CardDescription className="text-sm">
              Lägg till den utrustning du vill beställa. Din beställning skickas till vald chef för attestering.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
              {/* Equipment items */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Utrustning *</Label>
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {renderTypeSelect(item, index)}
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-20 h-12 md:h-10 text-center"
                      title="Antal"
                    />
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  className="gap-1.5 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Lägg till utrustning
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Kommentar</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ytterligare information..."
                  rows={3}
                  maxLength={1000}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Godkännare (närmaste chef) *</Label>
                <Select value={approverId} onValueChange={setApproverId}>
                  <SelectTrigger className="h-12 md:h-10">
                    <SelectValue placeholder="Välj chef..." />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="py-3 md:py-2">
                        {m.full_name || m.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full gap-2 h-12 md:h-11 text-base gradient-primary hover:opacity-90 shadow-md shadow-primary/20"
                disabled={submitting}
              >
                <Send className="h-4 w-4" />
                {submitting ? "Skickar..." : "Skicka beställning"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
