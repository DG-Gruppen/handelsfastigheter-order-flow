import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, HelpCircle, GripVertical, Check } from "lucide-react";
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

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
}

const emptyForm = { question: "", answer: "" };

function SortableFaqItem({
  item,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  item: FaqItem;
  onEdit: (item: FaqItem) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, current: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : !item.is_active ? 0.5 : 1,
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
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground">{item.question}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.answer}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Switch
          checked={item.is_active}
          onCheckedChange={() => onToggleActive(item.id, item.is_active)}
          className="mr-1"
        />
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => onEdit(item)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-destructive"
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function FaqManager({ onClose }: { onClose?: () => void }) {
  const [items, setItems] = useState<FaqItem[]>([]);
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
      .from("it_faq")
      .select("*")
      .order("sort_order");
    setItems((data as FaqItem[]) ?? []);
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

  const openEdit = (item: FaqItem) => {
    setEditingId(item.id);
    setForm({ question: item.question, answer: item.answer });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error("Fyll i både fråga och svar");
      return;
    }
    setSubmitting(true);

    if (editingId) {
      const { error } = await supabase
        .from("it_faq")
        .update({ question: form.question.trim(), answer: form.answer.trim() } as any)
        .eq("id", editingId);
      if (error) toast.error("Kunde inte uppdatera");
      else toast.success("FAQ uppdaterad");
    } else {
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) : 0;
      const { error } = await supabase.from("it_faq").insert({
        question: form.question.trim(),
        answer: form.answer.trim(),
        sort_order: maxOrder + 1,
      } as any);
      if (error) toast.error("Kunde inte skapa");
      else toast.success("FAQ skapad");
    }

    setDialogOpen(false);
    setSubmitting(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("it_faq").delete().eq("id", id);
    toast.success("FAQ borttagen");
    fetchData();
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from("it_faq").update({ is_active: !current } as any).eq("id", id);
    fetchData();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);

    // Optimistic update
    setItems(reordered);

    // Persist new sort orders
    await Promise.all(
      reordered.map((item, index) =>
        supabase.from("it_faq").update({ sort_order: index } as any).eq("id", item.id)
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
                <HelpCircle className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle className="font-heading text-base md:text-lg text-accent">Vanliga frågor (FAQ)</CardTitle>
                <CardDescription className="text-xs">Hantera frågor som visas på IT-supportsidan</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" className="h-10 w-10" onClick={openNew}>
                <Plus className="h-4 w-4" />
              </Button>
              {onClose && (
                <Button variant="ghost" size="icon" className="h-10 w-10 text-accent hover:bg-accent/10 hover:text-accent" onClick={onClose}>
                  <Check className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Laddar...</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Inga FAQ tillagda ännu</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {items.map((item) => (
                    <SortableFaqItem
                      key={item.id}
                      item={item}
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
            <DialogTitle>{editingId ? "Redigera fråga" : "Ny fråga"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fråga *</Label>
              <Input
                value={form.question}
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                placeholder="T.ex. Hur återställer jag mitt lösenord?"
                className="h-12 md:h-10"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Svar *</Label>
              <Textarea
                value={form.answer}
                onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                placeholder="Skriv ett tydligt svar..."
                rows={4}
                maxLength={1000}
                className="resize-none"
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
