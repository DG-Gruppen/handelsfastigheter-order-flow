import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Trash2, X, Plus, CreditCard, Users, Tag, CheckSquare, Calendar,
  Paperclip, ArrowRight, Copy, Archive, FileText, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlannerCard } from "./KanbanCard";
import type { PlannerColumn } from "./KanbanColumn";
import CardComments from "./CardComments";
import CardChecklists from "./CardChecklists";

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
  const [dueDone, setDueDone] = useState(false);
  const [columnId, setColumnId] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description ?? "");
      setPriority(card.priority);
      setAssigneeId(card.assignee_id ?? "");
      setDueDate(card.due_date ?? "");
      setDueDone(card.due_done ?? false);
      setColumnId(card.column_id);
      setLabels(card.labels ?? []);
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setAssigneeId("");
      setDueDate("");
      setDueDone(false);
      setColumnId(defaultColumnId ?? "");
      setLabels([]);
    }
    setEditingDescription(false);
    setEditingTitle(false);
  }, [card, open, defaultColumnId]);

  const handleSave = useCallback(() => {
    if (!title.trim()) return;
    onSave({
      ...(card ? { id: card.id } : {}),
      title: title.trim(),
      description,
      priority: priority as PlannerCard["priority"],
      assignee_id: assigneeId || null,
      due_date: dueDate || null,
      due_done: dueDone,
      column_id: columnId,
      labels,
    });
    onClose();
  }, [card, title, description, priority, assigneeId, dueDate, dueDone, columnId, labels, onSave, onClose]);

  const addLabel = () => {
    const l = newLabel.trim();
    if (l && !labels.includes(l)) {
      setLabels(prev => [...prev, l]);
    }
    setNewLabel("");
  };

  const columnName = columns.find(c => c.id === columnId)?.name ?? "";
  const assigneeName = profiles.find(p => p.user_id === assigneeId)?.full_name;
  const isOverdue = dueDate && !dueDone && new Date(dueDate) < new Date();
  const isNewCard = !card;

  const labelColors = [
    "bg-emerald-500", "bg-yellow-500", "bg-orange-500", "bg-red-500",
    "bg-purple-500", "bg-blue-500", "bg-sky-400", "bg-pink-500",
  ];
  const getLabelColor = (label: string) => {
    const idx = Math.abs(label.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % labelColors.length;
    return labelColors[idx];
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{card ? "Redigera kort" : "Nytt kort"}</DialogTitle>
          <DialogDescription>
            {card ? "Redigera kortets detaljer" : "Skapa ett nytt kort"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row min-h-0">
          {/* ─── LEFT COLUMN ─── */}
          <div className="flex-1 p-5 space-y-5 min-w-0 overflow-y-auto">
            {/* Title */}
            <div>
              <div className="flex items-start gap-2">
                <CreditCard className="h-5 w-5 mt-1 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  {editingTitle || isNewCard ? (
                    <Input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      onBlur={() => setEditingTitle(false)}
                      placeholder="Korttitel..."
                      className="text-lg font-semibold border-none shadow-none px-0 h-auto focus-visible:ring-0"
                      autoFocus={isNewCard || editingTitle}
                    />
                  ) : (
                    <h2
                      className="text-lg font-semibold text-foreground cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
                      onClick={() => setEditingTitle(true)}
                    >
                      {title || "Utan titel"}
                    </h2>
                  )}
                  {columnName && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      i listan <span className="font-medium underline decoration-dotted">{columnName}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Metadata row */}
            {(labels.length > 0 || dueDate || assigneeId) && (
              <div className="flex flex-wrap items-center gap-3">
                {/* Labels */}
                {labels.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Etiketter</p>
                    <div className="flex flex-wrap gap-1">
                      {labels.map(l => (
                        <span
                          key={l}
                          className={cn("text-[11px] text-white font-medium rounded px-2 py-0.5 cursor-default", getLabelColor(l))}
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Due date */}
                {dueDate && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Förfallodatum</p>
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        checked={dueDone}
                        onCheckedChange={(v) => setDueDone(!!v)}
                        className="h-3.5 w-3.5"
                      />
                      <span className={cn(
                        "text-xs font-medium rounded px-2 py-0.5",
                        dueDone
                          ? "bg-accent text-accent-foreground"
                          : isOverdue
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-muted text-muted-foreground"
                      )}>
                        {new Date(dueDate).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                )}

                {/* Assignee */}
                {assigneeName && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Tilldelad</p>
                    <div className="flex items-center gap-1.5">
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold">
                        {assigneeName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <span className="text-xs">{assigneeName}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Description */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Beskrivning</span>
                {!editingDescription && description && card && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditingDescription(true)}>
                    <Pencil className="h-3 w-3 mr-1" /> Redigera
                  </Button>
                )}
              </div>
              {editingDescription || isNewCard || !description ? (
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Lägg till en mer detaljerad beskrivning..."
                  rows={4}
                  className="resize-none text-sm"
                  onBlur={() => { if (card) setEditingDescription(false); }}
                  autoFocus={editingDescription}
                />
              ) : (
                <div
                  className="text-sm text-foreground/80 bg-muted/40 rounded-lg p-3 cursor-pointer hover:bg-muted/60 transition-colors whitespace-pre-wrap min-h-[60px]"
                  onClick={() => setEditingDescription(true)}
                >
                  {description}
                </div>
              )}
            </div>

            {/* Checklists */}
            {card && (
              <>
                <Separator />
                <CardChecklists cardId={card.id} />
              </>
            )}

            {/* Comments */}
            {card && (
              <>
                <Separator />
                <CardComments cardId={card.id} profiles={profiles} />
              </>
            )}
          </div>

          {/* ─── RIGHT SIDEBAR ─── */}
          <div className="md:w-48 border-t md:border-t-0 md:border-l border-border p-4 space-y-5 bg-muted/20 shrink-0">
            {/* Add to card */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Lägg till på kort</p>
              <div className="space-y-1">
                {/* Members */}
                <SidebarSelect
                  icon={Users}
                  label="Tilldelad"
                  value={assigneeId || "__none__"}
                  onValueChange={v => setAssigneeId(v === "__none__" ? "" : v)}
                  options={[
                    { value: "__none__", label: "Ingen" },
                    ...profiles.map(p => ({ value: p.user_id, label: p.full_name })),
                  ]}
                />

                {/* Labels */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-foreground mb-1">
                    <Tag className="h-3.5 w-3.5" />
                    <span>Etiketter</span>
                  </div>
                  <div className="flex gap-1">
                    <Input
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      placeholder="Ny..."
                      className="h-7 text-xs flex-1"
                      onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addLabel())}
                    />
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={addLabel} disabled={!newLabel.trim()}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {labels.map(l => (
                        <Badge key={l} variant="secondary" className="text-[10px] gap-0.5 pr-0.5 h-5">
                          <span className={cn("h-2 w-2 rounded-full mr-0.5", getLabelColor(l))} />
                          {l}
                          <button onClick={() => setLabels(prev => prev.filter(x => x !== l))}
                            className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Due date */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-foreground mb-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Förfallodatum</span>
                  </div>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-7 text-xs" />
                  {dueDate && (
                    <div className="flex items-center gap-2 mt-1">
                      <Switch
                        checked={dueDone}
                        onCheckedChange={setDueDone}
                        id="due-done-sidebar"
                        className="scale-75 origin-left"
                      />
                      <Label htmlFor="due-done-sidebar" className="text-[10px] cursor-pointer">Klar</Label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Åtgärder</p>
              <div className="space-y-1">
                {/* Move (column + priority) */}
                <SidebarSelect
                  icon={ArrowRight}
                  label="Flytta"
                  value={columnId}
                  onValueChange={setColumnId}
                  options={columns.map(c => ({ value: c.id, label: c.name }))}
                />

                <SidebarSelect
                  icon={ArrowRight}
                  label="Prioritet"
                  value={priority}
                  onValueChange={setPriority}
                  options={[
                    { value: "low", label: "Låg" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "Hög" },
                    { value: "urgent", label: "Brådskande" },
                  ]}
                />

                {card && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-destructive hover:bg-destructive/10 h-7 text-xs"
                    onClick={() => { onDelete(card.id); onClose(); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Ta bort
                  </Button>
                )}
              </div>
            </div>

            {/* Save / Cancel */}
            <Separator />
            <div className="space-y-1.5">
              <Button onClick={handleSave} disabled={!title.trim()} className="w-full h-8 text-xs">
                {card ? "Spara" : "Skapa"}
              </Button>
              <Button variant="outline" onClick={onClose} className="w-full h-8 text-xs">
                Avbryt
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sidebar Select Helper ─── */
function SidebarSelect({ icon: Icon, label, value, onValueChange, options }: {
  icon: React.ElementType;
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
