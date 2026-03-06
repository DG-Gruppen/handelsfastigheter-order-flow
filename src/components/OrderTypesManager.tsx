import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Laptop,
  Smartphone,
  Monitor,
  Keyboard,
  Mouse,
  Headphones,
  Package,
  Wifi,
  Printer,
  HardDrive,
  Usb,
  Tablet,
  Watch,
  Camera,
  Speaker,
  Cable,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  laptop: Laptop,
  smartphone: Smartphone,
  monitor: Monitor,
  keyboard: Keyboard,
  mouse: Mouse,
  headphones: Headphones,
  package: Package,
  wifi: Wifi,
  printer: Printer,
  "hard-drive": HardDrive,
  usb: Usb,
  tablet: Tablet,
  watch: Watch,
  camera: Camera,
  speaker: Speaker,
  cable: Cable,
};

const iconOptions = Object.keys(iconMap);

const categoryLabels: Record<string, string> = {
  computer: "Dator",
  phone: "Telefon",
  peripheral: "Kringutrustning",
  other: "Övrigt",
};

interface OrderType {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  is_active: boolean;
}

const emptyForm = {
  name: "",
  category: "other",
  description: "",
  icon: "package",
  is_active: true,
};

export default function OrderTypesManager() {
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchTypes = async () => {
    const { data } = await supabase
      .from("order_types")
      .select("*")
      .order("category")
      .order("name");
    setOrderTypes((data as OrderType[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTypes();
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
      category: ot.category,
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

    if (editingId) {
      const { error } = await supabase
        .from("order_types")
        .update({
          name: form.name.trim(),
          category: form.category,
          description: form.description.trim(),
          icon: form.icon,
          is_active: form.is_active,
        } as any)
        .eq("id", editingId);
      if (error) toast.error("Kunde inte uppdatera");
      else toast.success("Utrustningstyp uppdaterad");
    } else {
      const { error } = await supabase.from("order_types").insert({
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim(),
        icon: form.icon,
        is_active: form.is_active,
      } as any);
      if (error) toast.error("Kunde inte skapa");
      else toast.success("Utrustningstyp skapad");
    }

    setDialogOpen(false);
    setSubmitting(false);
    fetchTypes();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("order_types").delete().eq("id", id);
    if (error) toast.error("Kunde inte ta bort");
    else {
      toast.success("Utrustningstyp borttagen");
      fetchTypes();
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from("order_types").update({ is_active: !current } as any).eq("id", id);
    fetchTypes();
  };

  const grouped = orderTypes.reduce<Record<string, OrderType[]>>((acc, ot) => {
    if (!acc[ot.category]) acc[ot.category] = [];
    acc[ot.category].push(ot);
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
              {Object.entries(grouped).map(([cat, types]) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {categoryLabels[cat] ?? cat}
                  </p>
                  <div className="space-y-2">
                    {types.map((ot) => {
                      const IconComp = iconMap[ot.icon] ?? Package;
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
                            <p className="font-medium text-sm text-foreground truncate">
                              {ot.name}
                            </p>
                            {ot.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {ot.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Switch
                              checked={ot.is_active}
                              onCheckedChange={() => handleToggleActive(ot.id, ot.is_active)}
                              className="mr-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10"
                              onClick={() => openEdit(ot)}
                            >
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="mx-4 max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Redigera utrustningstyp" : "Ny utrustningstyp"}
            </DialogTitle>
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
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger className="h-12 md:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="computer" className="py-3 md:py-2">💻 Dator</SelectItem>
                  <SelectItem value="phone" className="py-3 md:py-2">📱 Telefon</SelectItem>
                  <SelectItem value="peripheral" className="py-3 md:py-2">🖥️ Kringutrustning</SelectItem>
                  <SelectItem value="other" className="py-3 md:py-2">📦 Övrigt</SelectItem>
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
              {submitting ? "Sparar..." : editingId ? "Spara ändringar" : "Skapa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
