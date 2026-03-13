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
import DepartmentPicker from "@/components/DepartmentPicker";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

function SortableCategoryItem({
  category,
  deptLabel,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  category: Category;
  deptLabel: string;
  onEdit: (c: Category) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, current: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  const IconComp = getIcon(category.icon);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : !category.is_active ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-border p-3 md:p-3.5 flex items-center gap-3 bg-card"
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex h-8 w-8 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
        <IconComp className="h-4 w-4 md:h-5 md:w-5 text-secondary-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground">{category.name}</p>
        <p className="text-xs text-muted-foreground">{deptLabel}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Switch
          checked={category.is_active}
          onCheckedChange={() => onToggleActive(category.id, category.is_active)}
          className="mr-1"
        />
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => onEdit(category)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-destructive"
          onClick={() => onDelete(category.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

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
    setFormDepts(departments.map((d) => d.id));
    setDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditingId(c.id);
    setForm({ name: c.name, icon: c.icon });
    const existing = categoryDepts[c.id];
    setFormDepts(existing && existing.length > 0 ? existing : departments.map((d) => d.id));
    setDialogOpen(true);
  };

  const saveDepartments = async (categoryId: string, deptIds: string[]) => {
    await supabase.from("category_departments").delete().eq("category_id", categoryId);
    if (deptIds.length < departments.length && deptIds.length > 0) {
      await supabase.from("category_departments").insert(
        deptIds.map((d) => ({ category_id: categoryId, department_id: d })) as any
      );
    }
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);

    setCategories(reordered);

    await Promise.all(
      reordered.map((c, index) =>
        supabase.from("categories").update({ sort_order: index } as any).eq("id", c.id)
      )
    );
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
            <Button size="icon" className="h-10 w-10" onClick={openNew}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Laddar...</p>
          ) : categories.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Inga kategorier ännu</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {categories.map((c) => (
                    <SortableCategoryItem
                      key={c.id}
                      category={c}
                      deptLabel={getDeptLabel(c.id)}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
