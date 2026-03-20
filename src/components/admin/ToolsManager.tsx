import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Pencil, Trash2, ExternalLink, GripVertical, Star } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
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
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Tool {
  id: string;
  name: string;
  description: string;
  emoji: string;
  url: string;
  sort_order: number;
  is_active: boolean;
  is_starred: boolean;
}

/* ── Sortable tool row ── */
function SortableToolRow({
  tool,
  onToggleStar,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  tool: Tool;
  onToggleStar: (t: Tool) => void;
  onToggleActive: (t: Tool) => void;
  onEdit: (t: Tool) => void;
  onDelete: (t: Tool) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tool.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border border-border bg-card transition-opacity ${
        !tool.is_active ? "opacity-50" : ""
      } ${isDragging ? "shadow-lg" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing shrink-0 touch-none"
        aria-label="Dra för att sortera"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
      </button>
      <span className="text-xl shrink-0">{tool.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{tool.name}</p>
          <a href={tool.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
      </div>
      <button
        onClick={() => onToggleStar(tool)}
        className="shrink-0 p-1 rounded hover:bg-secondary transition-colors"
        title={tool.is_starred ? "Ta bort från snabbåtkomst" : "Visa i snabbåtkomst"}
      >
        <Star className={`h-4 w-4 ${tool.is_starred ? "fill-warning text-warning" : "text-muted-foreground/40"}`} />
      </button>
      <Switch
        checked={tool.is_active}
        onCheckedChange={() => onToggleActive(tool)}
        aria-label="Aktiv"
      />
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(tool)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(tool)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function ToolsManager() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tool | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Tool | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🔗");
  const [url, setUrl] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchTools = async () => {
    const { data } = await supabase
      .from("tools" as any)
      .select("*")
      .order("sort_order");
    setTools(((data as unknown) as Tool[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTools(); }, []);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setEmoji("🔗");
    setUrl("");
    setDialogOpen(true);
  };

  const openEdit = (tool: Tool) => {
    setEditing(tool);
    setName(tool.name);
    setDescription(tool.description);
    setEmoji(tool.emoji);
    setUrl(tool.url);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !url.trim()) return;
    if (editing) {
      await supabase.from("tools" as any).update({
        name: name.trim(), description: description.trim(), emoji: emoji.trim(), url: url.trim(),
      }).eq("id", editing.id);
      toast.success("Verktyg uppdaterat");
    } else {
      await supabase.from("tools" as any).insert({
        name: name.trim(), description: description.trim(), emoji: emoji.trim(), url: url.trim(),
        sort_order: tools.length,
      });
      toast.success("Verktyg skapat");
    }
    setDialogOpen(false);
    fetchTools();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("tools" as any).delete().eq("id", id);
    toast.success("Verktyg borttaget");
    setConfirmDelete(null);
    fetchTools();
  };

  const handleToggleActive = async (tool: Tool) => {
    await supabase.from("tools" as any).update({ is_active: !tool.is_active }).eq("id", tool.id);
    setTools(prev => prev.map(t => t.id === tool.id ? { ...t, is_active: !t.is_active } : t));
  };

  const MAX_STARRED = 6;
  const starredCount = tools.filter(t => t.is_starred).length;

  const handleToggleStar = async (tool: Tool) => {
    if (!tool.is_starred && starredCount >= MAX_STARRED) {
      toast.error(`Max ${MAX_STARRED} verktyg kan visas i snabbåtkomst`);
      return;
    }
    await supabase.from("tools" as any).update({ is_starred: !tool.is_starred }).eq("id", tool.id);
    setTools(prev => prev.map(t => t.id === tool.id ? { ...t, is_starred: !t.is_starred } : t));
  };

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tools.findIndex(t => t.id === active.id);
    const newIndex = tools.findIndex(t => t.id === over.id);
    const reordered = arrayMove(tools, oldIndex, newIndex);

    // Optimistic update
    setTools(reordered);

    // Persist new sort_order for all affected items
    const updates = reordered.map((t, i) => ({ id: t.id, sort_order: i }));
    for (const u of updates) {
      await supabase.from("tools" as any).update({ sort_order: u.sort_order }).eq("id", u.id);
    }
  }, [tools]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground">Verktyg</h2>
          <p className="text-sm text-muted-foreground">Hantera snabblänkar som visas på verktygssidan. Dra för att ändra ordning.</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Lägg till
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tools.map(t => t.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {tools.map((tool) => (
              <SortableToolRow
                key={tool.id}
                tool={tool}
                onToggleStar={handleToggleStar}
                onToggleActive={handleToggleActive}
                onEdit={openEdit}
                onDelete={setConfirmDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Redigera verktyg" : "Nytt verktyg"}</DialogTitle>
            <DialogDescription>
              {editing ? "Uppdatera verktygets information." : "Lägg till ett nytt verktyg som visas på verktygssidan."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-3 items-end">
              <div>
                <Label>Emoji</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-14 h-10 text-xl">{emoji}</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-0" side="bottom" align="start">
                    <Picker data={data} onEmojiSelect={(e: any) => setEmoji(e.native)} theme="light" previewPosition="none" skinTonePosition="none" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex-1">
                <Label>Namn</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="t.ex. Vitec" autoFocus />
              </div>
            </div>
            <div>
              <Label>Beskrivning</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Kort beskrivning" />
            </div>
            <div>
              <Label>URL</Label>
              <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." type="url" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Avbryt</Button>
              <Button onClick={handleSave} disabled={!name.trim() || !url.trim()}>
                {editing ? "Spara" : "Lägg till"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={v => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort verktyg</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort <span className="font-semibold">"{confirmDelete?.name}"</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && handleDelete(confirmDelete.id)}
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
