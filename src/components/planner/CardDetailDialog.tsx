import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Trash2, X, Plus } from "lucide-react";
import type { PlannerCard } from "./KanbanCard";
import type { PlannerColumn } from "./KanbanColumn";
import CardComments from "./CardComments";

interface Profile {
  user_id: string;
  full_name: string;
}

interface Props {
  card: PlannerCard | null;
  columns: PlannerColumn[];
  profiles: Profile[];
  open: boolean;
  onClose: () => void;
  onSave: (card: Partial<PlannerCard> & { id?: string }) => void;
  onDelete: (id: string) => void;
  defaultColumnId?: string;
}

export default function CardDetailDialog({
  card, columns, profiles, open, onClose, onSave, onDelete, defaultColumnId,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [columnId, setColumnId] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description);
      setPriority(card.priority);
      setAssigneeId(card.assignee_id ?? "");
      setDueDate(card.due_date ?? "");
      setColumnId(card.column_id);
      setLabels(card.labels ?? []);
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setAssigneeId("");
      setDueDate("");
      setColumnId(defaultColumnId ?? "");
      setLabels([]);
    }
  }, [card, open, defaultColumnId]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      ...(card ? { id: card.id } : {}),
      title: title.trim(),
      description,
      priority: priority as PlannerCard["priority"],
      assignee_id: assigneeId || null,
      due_date: dueDate || null,
      column_id: columnId,
      labels,
    });
    onClose();
  };

  const addLabel = () => {
    const l = newLabel.trim();
    if (l && !labels.includes(l)) {
      setLabels(prev => [...prev, l]);
    }
    setNewLabel("");
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{card ? "Redigera kort" : "Nytt kort"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="card-title">Titel</Label>
            <Input
              id="card-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Vad behöver göras?"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="card-desc">Beskrivning</Label>
            <Textarea
              id="card-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detaljer..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kolumn</Label>
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger><SelectValue placeholder="Välj kolumn" /></SelectTrigger>
                <SelectContent>
                  {columns.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prioritet</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Låg</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">Hög</SelectItem>
                  <SelectItem value="urgent">Brådskande</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tilldelad</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder="Ingen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Ingen</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Förfallodatum</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Labels */}
          <div>
            <Label>Etiketter</Label>
            <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
              {labels.map(l => (
                <Badge key={l} variant="secondary" className="gap-1 pr-1">
                  {l}
                  <button onClick={() => setLabels(prev => prev.filter(x => x !== l))}
                    className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Ny etikett..."
                className="flex-1"
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addLabel())}
              />
              <Button variant="outline" size="sm" onClick={addLabel} disabled={!newLabel.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {card && (
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10"
                onClick={() => { onDelete(card.id); onClose(); }}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Ta bort
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={onClose}>Avbryt</Button>
              <Button onClick={handleSave} disabled={!title.trim()}>
                {card ? "Spara" : "Skapa"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
