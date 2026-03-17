import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ExternalLink, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

interface Tool {
  id: string;
  name: string;
  description: string;
  emoji: string;
  url: string;
  sort_order: number;
  is_active: boolean;
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
          <p className="text-sm text-muted-foreground">Hantera snabblänkar som visas på verktygssidan</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Lägg till
        </Button>
      </div>

      <div className="space-y-2">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className={`flex items-center gap-3 p-3 rounded-lg border border-border bg-card transition-opacity ${
              !tool.is_active ? "opacity-50" : ""
            }`}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
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
            <Switch
              checked={tool.is_active}
              onCheckedChange={() => handleToggleActive(tool)}
              aria-label="Aktiv"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tool)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setConfirmDelete(tool)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

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
            <div className="flex gap-3">
              <div className="w-20">
                <Label>Emoji</Label>
                <Input value={emoji} onChange={e => setEmoji(e.target.value)} className="text-center text-lg" />
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
