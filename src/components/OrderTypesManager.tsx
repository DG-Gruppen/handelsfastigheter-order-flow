import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { iconMap, iconOptions, getIcon } from "@/lib/icons";

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
  is_active: boolean;
}

const emptyForm = {
  name: "",
  category_id: "",
  description: "",
  icon: "package",
  is_active: true,
};

export default function OrderTypesManager() {
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    const [typesRes, catsRes] = await Promise.all([
      supabase.from("order_types").select("*").order("name"),
      supabase.from("categories").select("id, name, icon").eq("is_active", true).order("sort_order"),
    ]);
    setOrderTypes((typesRes.data as OrderType[]) ?? []);
    setCategories((catsRes.data as Category[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (ot: OrderType) => {
    setEditingId(ot.id);
    setForm({
      name: ot.name,
      category_id: ot.category_id || "",
      description: ot.description || "",
      icon: ot.icon || "package",
      is_active: ot.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Ange ett namn");
      return;
    }
    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      category_id: form.category_id || null,
      description: form.description.trim(),
      icon: form.icon,
      is_active: form.is_active,
    };

    if (editingId) {
      const { error } = await supabase.from("order_types").update(payload as any).eq("id", editingId);
      if (error) toast.error("Kunde inte uppdatera");
      else toast.success("Utrustningstyp uppdaterad");
    } else {
      const { error } = await supabase.from("order_types").insert(payload as any);
      if (error) toast.error("Kunde inte skapa");
      else toast.success("Utrustningstyp skapad");
    }

    setDialogOpen(false);
    setSubmitting(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("order_types").delete().eq("id", id);
    if (error) toast.error("Kunde inte ta bort");
    else {
      toast.success("Utrustningstyp borttagen");
      fetchData();
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from("order_types").update({ is_active: !current } as any).eq("id", id);
    fetchData();
  };

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const grouped = orderTypes.reduce<Record<string, OrderType[]>>((acc, ot) => {
    const catId = ot.category_id || "uncategorized";
    if (!acc[catId]) acc[catId] = [];
    acc[catId].push(ot);
    return acc;
  }, {});

  return (
    <>
      <Card className="glass-card">
        <CardHeader className="px-4 md:px-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-heading text-base md:text-lg">Utrustningstyper</CardTitle>
              <CardDescription className="text-sm">
                Hantera vilken utrustning som kan beställas
              </CardDescription>
            </div>
            <Button className="gap-1.5 h-11 md:h-10" onClick={openNew}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Lägg till</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Laddar...</p>
          ) : (
            <div className="space-y-5">
              {Object.entries(grouped).map(([catId, types]) => {
                const cat = catMap[catId];
                const CatIcon = cat ? getIcon(cat.icon) : Package;
                return (
                  <div key={catId}>
                    <div className="flex items-center gap-2 mb-2">
                      <CatIcon className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {cat?.name ?? "Utan kategori"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {types.map((ot) => {
                        const IconComp = getIcon(ot.icon);
                        return (
                          <div
                            key={ot.id}
                            className={`rounded-xl border border-border p-3 md:p-3.5 flex items-center gap-3 transition-opacity ${
                              !ot.is_active ? "opacity-50" : ""
                            }`}
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                              <IconComp className="h-5 w-5 text-secondary-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">{ot.name}</p>
                              {ot.description && (
                                <p className="text-xs text-muted-foreground truncate">{ot.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Switch
                                checked={ot.is_active}
                                onCheckedChange={() => handleToggleActive(ot.id, ot.is_active)}
                                className="mr-1"
                              />
                              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => openEdit(ot)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-destructive"
                                onClick={() => handleDelete(ot.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="mx-4 max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Redigera utrustningstyp" : "Ny utrustningstyp"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Namn *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="T.ex. MacBook Pro"
                className="h-12 md:h-10"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Kategori</Label>
              <Select
                value={form.category_id}
                onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}
              >
                <SelectTrigger className="h-12 md:h-10">
                  <SelectValue placeholder="Välj kategori..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => {
                    const CIcon = getIcon(c.icon);
                    return (
                      <SelectItem key={c.id} value={c.id} className="py-3 md:py-2">
                        <span className="flex items-center gap-2">
                          <CIcon className="h-4 w-4" />
                          {c.name}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Ikon</Label>
              <div className="grid grid-cols-8 gap-1.5">
                {iconOptions.map((key) => {
                  const Ic = iconMap[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, icon: key }))}
                      className={`flex h-10 w-full items-center justify-center rounded-lg border transition-colors ${
                        form.icon === key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <Ic className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Beskrivning</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Kort beskrivning..."
                rows={2}
                maxLength={300}
                className="resize-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Aktiv</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto h-11">
              Avbryt
            </Button>
            <Button onClick={handleSave} disabled={submitting} className="w-full sm:w-auto h-11">
              {submitting ? "Sparar..." : editingId ? "Spara" : "Skapa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
