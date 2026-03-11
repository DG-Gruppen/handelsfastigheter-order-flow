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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { iconMap, iconOptions, getIcon } from "@/lib/icons";
import DepartmentPicker from "@/components/DepartmentPicker";

interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

interface Department {
  id: string;
  name: string;
}

const emptyForm = { name: "", icon: "package" };

export default function CategoriesManager({ onUpdate }: { onUpdate?: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categoryDepts, setCategoryDepts] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formDepts, setFormDepts] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    const [catRes, deptRes, cdRes] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("category_departments").select("category_id, department_id"),
    ]);
    setCategories((catRes.data as Category[]) ?? []);
    setDepartments((deptRes.data as Department[]) ?? []);

    const map: Record<string, string[]> = {};
    for (const row of (cdRes.data as any[]) ?? []) {
      if (!map[row.category_id]) map[row.category_id] = [];
      map[row.category_id].push(row.department_id);
    }
    setCategoryDepts(map);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormDepts(departments.map((d) => d.id)); // all selected by default
    setDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditingId(c.id);
    setForm({ name: c.name, icon: c.icon });
    // If no rows exist yet for this category, treat as "all"
    const existing = categoryDepts[c.id];
    setFormDepts(existing && existing.length > 0 ? existing : departments.map((d) => d.id));
    setDialogOpen(true);
  };

  const saveDepartments = async (categoryId: string, deptIds: string[]) => {
    // Delete existing
    await supabase.from("category_departments").delete().eq("category_id", categoryId);
    // Insert new (only if not "all")
    if (deptIds.length < departments.length && deptIds.length > 0) {
      await supabase.from("category_departments").insert(
        deptIds.map((d) => ({ category_id: categoryId, department_id: d })) as any
      );
    }
    // If all selected, we store nothing (means "all")
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
      else {
        await saveDepartments(editingId, formDepts);
        toast.success("Kategori uppdaterad");
      }
    } else {
      const maxOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) : 0;
      const { data, error } = await supabase.from("categories").insert({
        name: form.name.trim(),
        icon: form.icon,
        sort_order: maxOrder + 1,
      } as any).select("id").single();
      if (error) toast.error("Kunde inte skapa");
      else {
        if (data) await saveDepartments((data as any).id, formDepts);
        toast.success("Kategori skapad");
      }
    }

    setDialogOpen(false);
    setSubmitting(false);
    fetchData();
    onUpdate?.();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast.error("Kan inte ta bort – kategorin används av utrustningstyper");
    } else {
      toast.success("Kategori borttagen");
      fetchData();
      onUpdate?.();
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from("categories").update({ is_active: !current } as any).eq("id", id);
    fetchData();
    onUpdate?.();
  };

  const getDeptLabel = (catId: string) => {
    const depts = categoryDepts[catId];
    if (!depts || depts.length === 0) return "Alla avdelningar";
    if (depts.length === departments.length) return "Alla avdelningar";
    return `${depts.length} avd.`;
  };

  return (
    <>
      <Card className="glass-card border-t-2 border-t-primary/40">
        <CardHeader className="px-4 md:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shadow-sm shadow-primary/10">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="font-heading text-base md:text-lg text-primary">Kategorier</CardTitle>
                <CardDescription className="text-xs">Skapa och hantera kategorier för utrustning</CardDescription>
              </div>
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
                        {getDeptLabel(c.id)}
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
            <div className="space-y-2">
              <Label className="text-sm font-medium">Synlig för avdelningar</Label>
              <DepartmentPicker
                departments={departments}
                selected={formDepts}
                onChange={setFormDepts}
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
