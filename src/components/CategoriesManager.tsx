import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { iconMap, iconOptions, getIcon } from "@/lib/icons";

interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

const emptyForm = { name: "", icon: "package" };

export default function CategoriesManager({ onUpdate }: { onUpdate?: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order");
    setCategories((data as Category[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditingId(c.id);
    setForm({ name: c.name, icon: c.icon });
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
        .from("categories")
        .update({ name: form.name.trim(), icon: form.icon } as any)
        .eq("id", editingId);
      if (error) toast.error("Kunde inte uppdatera");
      else toast.success("Kategori uppdaterad");
    } else {
      const maxOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) : 0;
      const { error } = await supabase.from("categories").insert({
        name: form.name.trim(),
        icon: form.icon,
        sort_order: maxOrder + 1,
      } as any);
      if (error) toast.error("Kunde inte skapa");
      else toast.success("Kategori skapad");
    }

    setDialogOpen(false);
    setSubmitting(false);
    fetchCategories();
    onUpdate?.();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast.error("Kan inte ta bort – kategorin används av utrustningstyper");
    } else {
      toast.success("Kategori borttagen");
      fetchCategories();
      onUpdate?.();
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from("categories").update({ is_active: !current } as any).eq("id", id);
    fetchCategories();
    onUpdate?.();
  };

  return (
    <>
      <Card className="glass-card">
        <CardHeader className="px-4 md:px-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-heading text-base md:text-lg">Kategorier</CardTitle>
              <CardDescription className="text-sm">
                Skapa och hantera kategorier för utrustning
              </CardDescription>
            </div>
            <Button className="gap-1.5 h-11 md:h-10" onClick={openNew}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Ny kategori</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Laddar...</p>
          ) : categories.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Inga kategorier ännu</p>
          ) : (
            <div className="space-y-2">
              {categories.map((c) => {
                const IconComp = getIcon(c.icon);
                return (
                  <div
                    key={c.id}
                    className={`rounded-xl border border-border p-3 md:p-3.5 flex items-center gap-3 transition-opacity ${
                      !c.is_active ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <IconComp className="h-5 w-5 text-secondary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Sortering: {c.sort_order}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={c.is_active}
                        onCheckedChange={() => handleToggleActive(c.id, c.is_active)}
                        className="mr-1"
                      />
                      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-destructive"
                        onClick={() => handleDelete(c.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
            <DialogTitle>{editingId ? "Redigera kategori" : "Ny kategori"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Namn *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="T.ex. Kontorsmöbler"
                className="h-12 md:h-10"
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Ikon</Label>
              <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
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
