import { useEffect, useState, useCallback } from "react";
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
import { Plus, Pencil, Trash2, Package, Copy, GripVertical } from "lucide-react";
import { iconMap, iconOptions, getIcon } from "@/lib/icons";
import DepartmentPicker from "@/components/DepartmentPicker";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Department {
  id: string;
  name: string;
}

interface OrderType {
  id: string;
  name: string;
  category_id: string | null;
  description: string;
  icon: string;
  is_active: boolean;
  sort_order: number;
}

const emptyForm = {
  name: "",
  category_id: "",
  description: "",
  icon: "package",
  is_active: true,
};

function SortableItem({
  ot,
  getDeptLabel,
  onToggleActive,
  onDuplicate,
  onEdit,
  onDelete,
}: {
  ot: OrderType;
  getDeptLabel: (id: string) => string;
  onToggleActive: (id: string, current: boolean) => void;
  onDuplicate: (ot: OrderType) => void;
  onEdit: (ot: OrderType) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ot.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };
  const IconComp = getIcon(ot.icon);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-border p-3 md:p-3.5 flex items-center gap-3 bg-card transition-opacity ${
        !ot.is_active ? "opacity-50" : ""
      }`}
    >
      <button
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
        <IconComp className="h-5 w-5 text-secondary-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">{ot.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {ot.description ? `${ot.description} · ` : ""}{getDeptLabel(ot.id)}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Switch
          checked={ot.is_active}
          onCheckedChange={() => onToggleActive(ot.id, ot.is_active)}
          className="mr-1"
        />
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => onDuplicate(ot)}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => onEdit(ot)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-destructive"
          onClick={() => onDelete(ot.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function OrderTypesManager() {
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [otDepts, setOtDepts] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formDepts, setFormDepts] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchData = async () => {
    const [typesRes, catsRes, deptRes, otdRes] = await Promise.all([
      supabase.from("order_types").select("*").order("sort_order").order("name"),
      supabase.from("categories").select("id, name, icon").eq("is_active", true).order("name"),
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("order_type_departments").select("order_type_id, department_id"),
    ]);
    setOrderTypes((typesRes.data as OrderType[]) ?? []);
    setCategories((catsRes.data as Category[]) ?? []);
    setDepartments((deptRes.data as Department[]) ?? []);

    const map: Record<string, string[]> = {};
    for (const row of (otdRes.data as any[]) ?? []) {
      if (!map[row.order_type_id]) map[row.order_type_id] = [];
      map[row.order_type_id].push(row.department_id);
    }
    setOtDepts(map);
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

  const openEdit = (ot: OrderType) => {
    setEditingId(ot.id);
    setForm({
      name: ot.name,
      category_id: ot.category_id || "",
      description: ot.description || "",
      icon: ot.icon || "package",
      is_active: ot.is_active,
    });
    const existing = otDepts[ot.id];
    setFormDepts(existing && existing.length > 0 ? existing : departments.map((d) => d.id));
    setDialogOpen(true);
  };

  const openDuplicate = (ot: OrderType) => {
    setEditingId(null);
    setForm({
      name: `${ot.name} (kopia)`,
      category_id: ot.category_id || "",
      description: ot.description || "",
      icon: ot.icon || "package",
      is_active: ot.is_active,
    });
    const existing = otDepts[ot.id];
    setFormDepts(existing && existing.length > 0 ? [...existing] : departments.map((d) => d.id));
    setDialogOpen(true);
  };

  const saveDepartments = async (orderTypeId: string, deptIds: string[]) => {
    await supabase.from("order_type_departments").delete().eq("order_type_id", orderTypeId);
    if (deptIds.length < departments.length && deptIds.length > 0) {
      await supabase.from("order_type_departments").insert(
        deptIds.map((d) => ({ order_type_id: orderTypeId, department_id: d })) as any
      );
    }
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
      else {
        await saveDepartments(editingId, formDepts);
        toast.success("Utrustningstyp uppdaterad");
      }
    } else {
      const { data, error } = await supabase.from("order_types").insert(payload as any).select("id").single();
      if (error) toast.error("Kunde inte skapa");
      else {
        if (data) await saveDepartments((data as any).id, formDepts);
        toast.success("Utrustningstyp skapad");
      }
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

  const getDeptLabel = useCallback((otId: string) => {
    const depts = otDepts[otId];
    if (!depts || depts.length === 0) return "Alla avdelningar";
    if (depts.length === departments.length) return "Alla avdelningar";
    return `${depts.length} avd.`;
  }, [otDepts, departments]);

  const handleDragEnd = async (catId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const catTypes = grouped[catId];
    if (!catTypes) return;

    const oldIndex = catTypes.findIndex((t) => t.id === active.id);
    const newIndex = catTypes.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(catTypes, oldIndex, newIndex);

    // Optimistic update
    setOrderTypes((prev) => {
      const otherTypes = prev.filter((t) => (t.category_id || "uncategorized") !== catId);
      const updated = reordered.map((t, i) => ({ ...t, sort_order: i }));
      return [...otherTypes, ...updated];
    });

    // Persist
    const updates = reordered.map((t, i) => ({ id: t.id, sort_order: i }));
    for (const u of updates) {
      await supabase.from("order_types").update({ sort_order: u.sort_order } as any).eq("id", u.id);
    }
  };

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const grouped = orderTypes.reduce<Record<string, OrderType[]>>((acc, ot) => {
    const catId = ot.category_id || "uncategorized";
    if (!acc[catId]) acc[catId] = [];
    acc[catId].push(ot);
    return acc;
  }, {});

  // Sort categories alphabetically, "uncategorized" last
  const sortedCatIds = Object.keys(grouped).sort((a, b) => {
    if (a === "uncategorized") return 1;
    if (b === "uncategorized") return -1;
    const nameA = catMap[a]?.name ?? "";
    const nameB = catMap[b]?.name ?? "";
    return nameA.localeCompare(nameB, "sv");
  });

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
              {sortedCatIds.map((catId) => {
                const types = grouped[catId];
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
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => handleDragEnd(catId, e)}
                    >
                      <SortableContext items={types.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {types.map((ot) => (
                            <SortableItem
                              key={ot.id}
                              ot={ot}
                              getDeptLabel={getDeptLabel}
                              onToggleActive={handleToggleActive}
                              onDuplicate={openDuplicate}
                              onEdit={openEdit}
                              onDelete={handleDelete}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
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

            <div className="space-y-2">
              <Label className="text-sm font-medium">Synlig för avdelningar</Label>
              <DepartmentPicker
                departments={departments}
                selected={formDepts}
                onChange={setFormDepts}
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
