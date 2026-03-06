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
import { Send } from "lucide-react";
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

export default function NewOrder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [managers, setManagers] = useState<ProfileOption[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [approverId, setApproverId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [catsRes, typesRes, managersRes] = await Promise.all([
        supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("order_types").select("*").eq("is_active", true).order("name"),
        supabase.from("profiles").select("id, user_id, full_name").neq("user_id", user?.id ?? ""),
      ]);
      setCategories((catsRes.data as Category[]) ?? []);
      setOrderTypes((typesRes.data as OrderType[]) ?? []);
      setManagers((managersRes.data as ProfileOption[]) ?? []);
    };
    if (user) fetchData();
  }, [user]);

  const handleTypeChange = (typeId: string) => {
    setSelectedType(typeId);
    const ot = orderTypes.find((t) => t.id === typeId);
    if (ot) {
      setTitle(ot.name);
      setDescription(ot.description || "");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedType || !approverId || !title.trim()) {
      toast.error("Fyll i alla obligatoriska fält");
      return;
    }
    setSubmitting(true);

    const ot = orderTypes.find((t) => t.id === selectedType);
    const manager = managers.find((m) => m.id === approverId);

    const { error } = await supabase.from("orders").insert({
      requester_id: user.id,
      approver_id: manager?.user_id ?? null,
      order_type_id: selectedType,
      category_id: ot?.category_id ?? null,
      title: title.trim(),
      description: description.trim(),
    } as any);

    if (error) {
      toast.error("Kunde inte skapa beställningen");
      console.error(error);
    } else {
      toast.success("Beställningen har skickats till din chef för godkännande!");
      navigate("/dashboard");
    }
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

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto animate-fade-up">
        <Card className="glass-card shadow-xl shadow-primary/[0.03]">
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="font-heading text-lg md:text-xl">Ny beställning</CardTitle>
            <CardDescription className="text-sm">
              Din beställning skickas till vald chef för attestering.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Typ av utrustning *</Label>
                <Select value={selectedType} onValueChange={handleTypeChange}>
                  <SelectTrigger className="h-12 md:h-10">
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
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Rubrik *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="T.ex. Ny laptop till nyanställd"
                  maxLength={200}
                  className="h-12 md:h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Beskrivning</Label>
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
