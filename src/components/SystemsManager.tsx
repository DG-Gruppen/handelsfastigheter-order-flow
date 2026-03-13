import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Monitor, GripVertical } from "lucide-react";
import { iconMap, iconOptions, getIcon } from "@/lib/icons";
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

interface System {
  id: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

const emptyForm = { name: "", description: "", icon: "monitor" };

function SortableSystemItem({
  system,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  system: System;
  onEdit: (s: System) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, current: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: system.id,
  });
  const IconComp = getIcon(system.icon);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : !system.is_active ? 0.5 : 1,
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
        <p className="font-medium text-sm text-foreground">{system.name}</p>
        {system.description && (
          <p className="text-xs text-muted-foreground truncate">{system.description}</p>
        )}
      </div>
      <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
        <Switch
          checked={system.is_active}
          onCheckedChange={() => onToggleActive(system.id, system.is_active)}
          className="mr-0.5 md:mr-1"
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9" onClick={() => onEdit(system)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:h-9 md:w-9 text-destructive"
          onClick={() => onDelete(system.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function SystemsManager() {
  const [systems, setSystems] = useState<System[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const fetchData = async () => {
    const { data } = await supabase
      .from("systems")
      .select("*")
      .order("sort_order");
    setSystems((data as System[]) ?? []);
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

  const openEdit = (s: System) => {
    setEditingId(s.id);
    setForm({ name: s.name, description: s.description || "", icon: s.icon });
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
        .from("systems")
        .update({
          name: form.name.trim(),
          description: form.description.trim(),
          icon: form.icon,
        } as any)
        .eq("id", editingId);
      if (error) toast.error("Kunde inte uppdatera");
      else toast.success("System uppdaterat");
    } else {
      const maxOrder = systems.length > 0 ? Math.max(...systems.map((s) => s.sort_order)) : 0;
      const { error } = await supabase.from("systems").insert({
        name: form.name.trim(),
        description: form.description.trim(),
        icon: form.icon,
        sort_order: maxOrder + 1,
      } as any);
      if (error) toast.error("Kunde inte skapa");
      else toast.success("System skapat");
    }

    setDialogOpen(false);
    setSubmitting(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("systems").delete().eq("id", id);
    if (error) {
      toast.error("Kan inte ta bort – systemet används i beställningar");
    } else {
      toast.success("System borttaget");
      fetchData();
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from("systems").update({ is_active: !current } as any).eq("id", id);
    fetchData();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = systems.findIndex((s) => s.id === active.id);
    const newIndex = systems.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(systems, oldIndex, newIndex);

    setSystems(reordered);

    await Promise.all(
      reordered.map((s, index) =>
        supabase.from("systems").update({ sort_order: index } as any).eq("id", s.id)
      )
    );
    fetchData();
  };

  return (
    <>
      <Card className="glass-card border-t-2 border-t-accent/40">
        <CardHeader className="px-4 md:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 shadow-sm shadow-accent/10">
                <Monitor className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle className="font-heading text-base md:text-lg text-accent">System & Licenser</CardTitle>
                <CardDescription className="text-xs">Hantera system och licenser för on-/offboarding</CardDescription>
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
          ) : systems.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Inga system tillagda ännu</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={systems.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {systems.map((s) => (
                    <SortableSystemItem
                      key={s.id}
                      system={s}
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
            <DialogTitle>{editingId ? "Redigera system" : "Nytt system"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Namn *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="T.ex. Microsoft 365"
                className="h-12 md:h-10"
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Beskrivning</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="T.ex. E-post, Teams, Office-paketet"
                rows={2}
                maxLength={200}
                className="resize-none"
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
