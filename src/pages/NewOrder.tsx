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

interface OrderType {
  id: string;
  name: string;
  category: string;
  description: string;
}

interface ProfileOption {
  id: string;
  user_id: string;
  full_name: string;
}

export default function NewOrder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [managers, setManagers] = useState<ProfileOption[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [approverId, setApproverId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [typesRes, managersRes] = await Promise.all([
        supabase.from("order_types").select("*").eq("is_active", true),
        supabase.from("profiles").select("id, user_id, full_name").neq("user_id", user?.id ?? ""),
      ]);
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
      setDescription(ot.description);
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
      category: ot?.category ?? "other",
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

  const categoryLabels: Record<string, string> = {
    computer: "💻 Datorer",
    phone: "📱 Telefoner",
    peripheral: "🖥️ Kringutrustning",
    other: "📦 Övrigt",
  };

  const groupedTypes = orderTypes.reduce<Record<string, OrderType[]>>((acc, ot) => {
    const cat = ot.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ot);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Ny beställning</CardTitle>
            <CardDescription>
              Fyll i formuläret nedan. Din beställning skickas till vald chef för attestering.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="orderType">Typ av utrustning *</Label>
                <Select value={selectedType} onValueChange={handleTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj utrustning..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(groupedTypes).map(([cat, types]) => (
                      <div key={cat}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          {categoryLabels[cat] ?? cat}
                        </div>
                        {types.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Rubrik *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="T.ex. Ny laptop till nyanställd"
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beskrivning</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ytterligare information om beställningen..."
                  rows={4}
                  maxLength={1000}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="approver">Godkännare (närmaste chef) *</Label>
                <Select value={approverId} onValueChange={setApproverId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj chef..." />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name || m.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full gap-2" size="lg" disabled={submitting}>
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
