import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Trash2, X, Plus, CreditCard, Users, Tag, CheckSquare, Calendar,
  Paperclip, ArrowRight, FileText, AlignLeft, Palette, Copy, Archive,
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

const labelColors = [
  "bg-accent", "bg-warning", "bg-primary", "bg-destructive",
  "bg-purple-500", "bg-sky-500", "bg-pink-500", "bg-amber-500",
];
const getLabelColor = (label: string) => {
  const idx = Math.abs(label.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % labelColors.length;
  return labelColors[idx];
};

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
  const [coverColor, setCoverColor] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);

  // Sidebar popover states
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);

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
      setCoverColor(card.cover_color ?? null);
    } else {
      setTitle(""); setDescription(""); setPriority("medium");
      setAssigneeId(""); setDueDate(""); setDueDone(false);
      setColumnId(defaultColumnId ?? ""); setLabels([]); setCoverColor(null);
    }
    setEditingDescription(false); setEditingTitle(false);
    setShowMemberPicker(false); setShowLabelPicker(false);
    setShowDatePicker(false); setShowMovePicker(false); setShowCoverPicker(false);
  }, [card, open, defaultColumnId]);

  const handleSave = useCallback(() => {
    if (!title.trim()) return;
    onSave({
      ...(card ? { id: card.id } : {}),
      title: title.trim(), description,
      priority: priority as PlannerCard["priority"],
      assignee_id: assigneeId || null,
      due_date: dueDate || null,
      due_done: dueDone, column_id: columnId, labels,
      cover_color: coverColor,
    } as any);
    onClose();
  }, [card, title, description, priority, assigneeId, dueDate, dueDone, columnId, labels, coverColor, onSave, onClose]);

  const addLabel = () => {
    const l = newLabel.trim();
    if (l && !labels.includes(l)) setLabels(prev => [...prev, l]);
    setNewLabel("");
  };

  const columnName = columns.find(c => c.id === columnId)?.name ?? "";
  const assigneeName = profiles.find(p => p.user_id === assigneeId)?.full_name;
  const isOverdue = dueDate && !dueDone && new Date(dueDate) < new Date();
  const isNewCard = !card;

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[680px] max-h-[90vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{card ? "Redigera kort" : "Nytt kort"}</DialogTitle>
          <DialogDescription>{card ? "Redigera kortets detaljer" : "Skapa ett nytt kort"}</DialogDescription>
        </DialogHeader>

        <div
          className="h-12 rounded-t-lg shrink-0 transition-colors"
          style={{ backgroundColor: coverColor || "hsl(var(--primary))" }}
        />

        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] overflow-hidden" style={{ maxHeight: "calc(90vh - 48px)" }}>

          {/* ─── LEFT: Main content ─── */}
          <div className="overflow-y-auto p-4 md:p-5 space-y-5 min-w-0">

            {/* Title */}
            <div className="flex gap-2.5 items-start">
              <CreditCard className="h-4 w-4 mt-1.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                {editingTitle || isNewCard ? (
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={e => e.key === "Enter" && setEditingTitle(false)}
                    placeholder="Korttitel..."
                    className="text-[17px] font-medium border-none shadow-none px-0 h-auto focus-visible:ring-0 bg-transparent"
                    autoFocus={isNewCard || editingTitle}
                  />
                ) : (
                  <h2
                    className="text-[17px] font-medium text-foreground leading-snug cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
                    onClick={() => setEditingTitle(true)}
                  >
                    {title || "Utan titel"}
                  </h2>
                )}
                {columnName && (
                  <p className="text-xs text-muted-foreground mt-1">
                    i listan <span className="underline cursor-pointer">{columnName}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Metadata row: Labels + Due date + Members */}
            {(labels.length > 0 || dueDate || assigneeId) && (
              <div className="flex flex-wrap gap-4 ml-7">
                {labels.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">ETIKETTER</p>
                    <div className="flex flex-wrap gap-1.5">
                      {labels.map(l => (
                        <span key={l} className={cn("text-xs text-white font-medium rounded px-2.5 py-0.5", getLabelColor(l))}>
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {dueDate && (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">FÖRFALLODATUM</p>
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        checked={dueDone}
                        onCheckedChange={(v) => setDueDone(!!v)}
                        className="h-3.5 w-3.5"
                      />
                      <span className={cn(
                        "text-xs font-medium rounded px-2.5 py-0.5",
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
                {assigneeName && (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">MEDLEMMAR</p>
                    <div className="flex items-center gap-1.5">
                      <div className="h-[30px] w-[30px] rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-medium">
                        {getInitials(assigneeName)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div className="flex gap-2.5 items-start">
              <AlignLeft className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[13px] font-medium text-foreground">Beskrivning</span>
                  {!editingDescription && description && card && (
                    <Button variant="secondary" size="sm" className="h-6 text-[11px] px-2" onClick={() => setEditingDescription(true)}>
                      Redigera
                    </Button>
                  )}
                </div>
                {editingDescription || isNewCard || !description ? (
                  <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Lägg till en mer detaljerad beskrivning..."
                    rows={4}
                    className="resize-none text-[13px] bg-background border border-border"
                    onBlur={() => { if (card) setEditingDescription(false); }}
                    autoFocus={editingDescription}
                  />
                ) : (
                  <div
                    className="text-[13px] text-muted-foreground bg-background border border-border rounded-md p-3 cursor-pointer hover:bg-muted/30 transition-colors whitespace-pre-wrap leading-relaxed min-h-[60px]"
                    onClick={() => setEditingDescription(true)}
                  >
                    {description}
                  </div>
                )}
              </div>
            </div>

            {/* Checklists */}
            {card && (
              <div className="flex gap-2.5 items-start">
                <CheckSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <CardChecklists cardId={card.id} />
                </div>
              </div>
            )}

            {/* Activity / Comments */}
            {card && (
              <div className="flex gap-2.5 items-start">
                <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <CardComments cardId={card.id} profiles={profiles} />
                </div>
              </div>
            )}
          </div>

          {/* ─── RIGHT: Sidebar ─── */}
          <div className="border-t md:border-t-0 md:border-l border-border bg-background p-3 pt-12 overflow-y-auto space-y-1">

            {/* ADD TO CARD */}
            <p className="text-[11px] font-medium text-muted-foreground px-1 mb-1.5">LÄGG TILL KORT</p>

            <SidebarButton icon={Palette} label="Omslagsfärg" active={showCoverPicker} onClick={() => setShowCoverPicker(v => !v)} />
            {showCoverPicker && (
              <CoverColorPicker value={coverColor} onChange={setCoverColor} onClose={() => setShowCoverPicker(false)} />
            )}

            <SidebarButton icon={Users} label="Medlemmar" active={showMemberPicker} onClick={() => setShowMemberPicker(v => !v)} />
            {showMemberPicker && (
              <div className="bg-muted/50 rounded-md p-2 space-y-1">
                {profiles.map(p => (
                  <button
                    key={p.user_id}
                    className={cn(
                      "w-full text-left text-xs px-2 py-1.5 rounded flex items-center gap-2 hover:bg-muted transition-colors",
                      assigneeId === p.user_id && "bg-primary/10 text-primary font-medium"
                    )}
                    onClick={() => { setAssigneeId(assigneeId === p.user_id ? "" : p.user_id); setShowMemberPicker(false); }}
                  >
                    <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-medium shrink-0">
                      {getInitials(p.full_name)}
                    </div>
                    {p.full_name}
                  </button>
                ))}
                {assigneeId && (
                  <button className="w-full text-left text-xs px-2 py-1 text-muted-foreground hover:text-foreground" onClick={() => { setAssigneeId(""); setShowMemberPicker(false); }}>
                    Ta bort tilldelning
                  </button>
                )}
              </div>
            )}

            <SidebarButton icon={Tag} label="Etiketter" active={showLabelPicker} onClick={() => setShowLabelPicker(v => !v)} />
            {showLabelPicker && (
              <div className="bg-muted/50 rounded-md p-2 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {labels.map(l => (
                    <Badge key={l} variant="secondary" className="text-[10px] gap-0.5 pr-0.5 h-5">
                      <span className={cn("h-2 w-2 rounded-full mr-0.5", getLabelColor(l))} />
                      {l}
                      <button onClick={() => setLabels(prev => prev.filter(x => x !== l))} className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Input
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    placeholder="Ny etikett..."
                    className="h-7 text-xs flex-1"
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addLabel())}
                  />
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={addLabel} disabled={!newLabel.trim()}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            <SidebarButton icon={CheckSquare} label="Checklista" onClick={() => {/* handled inside CardChecklists */}} />

            <SidebarButton icon={Calendar} label="Förfallodatum" active={showDatePicker} onClick={() => setShowDatePicker(v => !v)} />
            {showDatePicker && (
              <div className="bg-muted/50 rounded-md p-2 space-y-2">
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-7 text-xs" />
                {dueDate && (
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={dueDone} onCheckedChange={v => setDueDone(!!v)} className="h-3.5 w-3.5" />
                    Markera som klar
                  </label>
                )}
                {dueDate && (
                  <button className="text-xs text-destructive hover:underline" onClick={() => { setDueDate(""); setDueDone(false); }}>
                    Ta bort datum
                  </button>
                )}
              </div>
            )}

            <SidebarButton icon={Paperclip} label="Bilaga" onClick={() => {}} />

            {/* ACTIONS */}
            <p className="text-[11px] font-medium text-muted-foreground px-1 mt-4 mb-1.5">ÅTGÄRDER</p>

            <SidebarButton icon={ArrowRight} label="Flytta" active={showMovePicker} onClick={() => setShowMovePicker(v => !v)} />
            {showMovePicker && (
              <div className="bg-muted/50 rounded-md p-2 space-y-1">
                <p className="text-[10px] text-muted-foreground mb-1">Kolumn</p>
                {columns.map(c => (
                  <button
                    key={c.id}
                    className={cn(
                      "w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors",
                      columnId === c.id && "bg-primary/10 text-primary font-medium"
                    )}
                    onClick={() => { setColumnId(c.id); setShowMovePicker(false); }}
                  >
                    {c.name}
                  </button>
                ))}
                <p className="text-[10px] text-muted-foreground mt-2 mb-1">Prioritet</p>
                {([
                  { value: "low", label: "Låg" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "Hög" },
                  { value: "urgent", label: "Brådskande" },
                ] as const).map(p => (
                  <button
                    key={p.value}
                    className={cn(
                      "w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors",
                      priority === p.value && "bg-primary/10 text-primary font-medium"
                    )}
                    onClick={() => setPriority(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {card && (
              <SidebarButton
                icon={Trash2}
                label="Arkivera"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => { onDelete(card.id); onClose(); }}
              />
            )}

            {/* Save / Cancel */}
            <div className="pt-3 space-y-1.5">
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

/* ─── Flat Sidebar Button ─── */
function SidebarButton({ icon: Icon, label, onClick, active, className }: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-md px-2.5 py-[6px] text-[13px] flex items-center gap-2 transition-colors",
        "bg-secondary hover:bg-secondary/80 text-foreground",
        active && "ring-1 ring-primary/30",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </button>
  );
}

/* ─── Cover Color Picker ─── */
const COVER_COLORS = [
  { value: "#2e4a62", label: "Himmel" },
  { value: "#3d7a6a", label: "Land" },
  { value: "#b34304", label: "Eld" },
  { value: "#5b9bd5", label: "Ljusblå" },
  { value: "#7c3aed", label: "Lila" },
  { value: "#059669", label: "Grön" },
  { value: "#d97706", label: "Amber" },
  { value: "#dc2626", label: "Röd" },
  { value: "#6b7280", label: "Grå" },
];

function CoverColorPicker({ value, onChange, onClose }: {
  value: string | null;
  onChange: (color: string | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="bg-muted/50 rounded-md p-2 space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {COVER_COLORS.map(c => (
          <button
            key={c.value}
            className={cn(
              "h-6 rounded transition-all",
              value === c.value && "ring-2 ring-offset-1 ring-primary"
            )}
            style={{ backgroundColor: c.value }}
            onClick={() => { onChange(c.value); onClose(); }}
            title={c.label}
          />
        ))}
      </div>
      {value && (
        <button
          className="text-xs text-destructive hover:underline"
          onClick={() => { onChange(null); onClose(); }}
        >
          Ta bort omslag
        </button>
      )}
    </div>
  );
}
