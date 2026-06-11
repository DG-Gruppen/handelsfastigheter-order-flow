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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, ExternalLink, GripVertical, Star, User } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable,
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
  owner_id: string | null;
  owner_keys?: string[];      // composite keys: "profile:<id>" | "external:<id>"
  owner_names?: string[];
  department_ids?: string[];
}

interface ProfileOpt { id: string; full_name: string; }
interface ExternalContactOpt { id: string; full_name: string; company_name: string | null; }
interface DepartmentOpt { id: string; name: string; }

function SortableToolRow({
  tool, departments, onToggleStar, onToggleActive, onEdit, onDelete,
}: {
  tool: Tool;
  departments: DepartmentOpt[];
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

  const deptNames = (tool.department_ids ?? [])
    .map(id => departments.find(d => d.id === id)?.name)
    .filter(Boolean) as string[];

  const ownerLabel = (tool.owner_names ?? []).join(" & ") || "Ingen ägare";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border border-border bg-card transition-opacity ${
        !tool.is_active ? "opacity-50" : ""
      } ${isDragging ? "shadow-lg" : ""}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 touch-none" aria-label="Dra för att sortera">
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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {ownerLabel}
          </span>
          {deptNames.length > 0 && <span className="truncate">• {deptNames.join(", ")}</span>}
        </div>
      </div>
      <button onClick={() => onToggleStar(tool)} className="shrink-0 p-1 rounded hover:bg-secondary transition-colors" title={tool.is_starred ? "Ta bort från snabbåtkomst" : "Visa i snabbåtkomst"}>
        <Star className={`h-4 w-4 ${tool.is_starred ? "fill-warning text-warning" : "text-muted-foreground/40"}`} />
      </button>
      <Switch checked={tool.is_active} onCheckedChange={() => onToggleActive(tool)} aria-label="Aktiv" />
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
  const [profiles, setProfiles] = useState<ProfileOpt[]>([]);
  const [externalContacts, setExternalContacts] = useState<ExternalContactOpt[]>([]);
  const [departments, setDepartments] = useState<DepartmentOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tool | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Tool | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🔗");
  const [url, setUrl] = useState("");
  // Owner keys use the format "profile:<id>" or "external:<id>"
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchAll = async () => {
    const [toolsRes, profilesRes, extRes, deptsRes, deptLinksRes, ownerLinksRes] = await Promise.all([
      supabase.from("tools" as any).select("*").order("sort_order"),
      supabase.from("profiles").select("id, full_name").eq("is_external", false).eq("is_hidden", false).order("full_name"),
      supabase.from("external_contacts" as any).select("id, full_name, company_name").eq("is_active", true).order("company_name", { nullsFirst: false }).order("full_name"),
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("tool_departments" as any).select("tool_id, department_id"),
      supabase.from("tool_owners" as any).select("tool_id, profile_id, external_contact_id"),
    ]);

    const profs = (profilesRes.data ?? []) as ProfileOpt[];
    const exts = ((extRes.data ?? []) as unknown) as ExternalContactOpt[];
    const depts = (deptsRes.data ?? []) as DepartmentOpt[];
    const deptLinks = ((deptLinksRes.data ?? []) as unknown) as { tool_id: string; department_id: string }[];
    const ownerLinks = ((ownerLinksRes.data ?? []) as unknown) as {
      tool_id: string;
      profile_id: string | null;
      external_contact_id: string | null;
    }[];

    const deptByTool = new Map<string, string[]>();
    for (const l of deptLinks) {
      const arr = deptByTool.get(l.tool_id) ?? [];
      arr.push(l.department_id);
      deptByTool.set(l.tool_id, arr);
    }

    const ownerByTool = new Map<string, string[]>();
    for (const l of ownerLinks) {
      const key = l.profile_id
        ? `profile:${l.profile_id}`
        : l.external_contact_id
          ? `external:${l.external_contact_id}`
          : null;
      if (!key) continue;
      const arr = ownerByTool.get(l.tool_id) ?? [];
      arr.push(key);
      ownerByTool.set(l.tool_id, arr);
    }

    const nameForKey = (k: string): string | null => {
      const [kind, id] = k.split(":");
      if (kind === "profile") return profs.find(p => p.id === id)?.full_name ?? null;
      if (kind === "external") {
        const c = exts.find(e => e.id === id);
        if (!c) return null;
        return c.company_name ? `${c.full_name} (${c.company_name})` : c.full_name;
      }
      return null;
    };

    const rawTools = ((toolsRes.data ?? []) as unknown) as Tool[];
    const decorated = rawTools.map(t => {
      const ownerKeys = ownerByTool.get(t.id) ?? (t.owner_id ? [`profile:${t.owner_id}`] : []);
      return {
        ...t,
        owner_keys: ownerKeys,
        owner_names: ownerKeys.map(nameForKey).filter(Boolean) as string[],
        department_ids: deptByTool.get(t.id) ?? [],
      };
    });

    setTools(decorated);
    setProfiles(profs);
    setExternalContacts(exts);
    setDepartments(depts);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEditing(null);
    setName(""); setDescription(""); setEmoji("🔗"); setUrl("");
    setSelectedOwners([]); setSelectedDepartments([]);
    setDialogOpen(true);
  };

  const openEdit = (tool: Tool) => {
    setEditing(tool);
    setName(tool.name); setDescription(tool.description);
    setEmoji(tool.emoji); setUrl(tool.url);
    setSelectedOwners(tool.owner_keys ?? []);
    setSelectedDepartments(tool.department_ids ?? []);
    setDialogOpen(true);
  };

  const syncDepartments = async (toolId: string, deptIds: string[]) => {
    await supabase.from("tool_departments" as any).delete().eq("tool_id", toolId);
    if (deptIds.length > 0) {
      await supabase.from("tool_departments" as any).insert(
        deptIds.map(department_id => ({ tool_id: toolId, department_id })),
      );
    }
  };

  const syncOwners = async (toolId: string, ownerKeys: string[]) => {
    await supabase.from("tool_owners" as any).delete().eq("tool_id", toolId);
    if (ownerKeys.length > 0) {
      const rows = ownerKeys.map(k => {
        const [kind, id] = k.split(":");
        return kind === "external"
          ? { tool_id: toolId, profile_id: null, external_contact_id: id }
          : { tool_id: toolId, profile_id: id, external_contact_id: null };
      });
      await supabase.from("tool_owners" as any).insert(rows);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !url.trim() || selectedOwners.length === 0) return;
    // tools.owner_id is now optional and is only set to the first internal profile owner (if any)
    const firstProfileKey = selectedOwners.find(k => k.startsWith("profile:"));
    const primaryOwner = firstProfileKey ? firstProfileKey.split(":")[1] : null;

    if (editing) {
      const { error } = await supabase.from("tools" as any).update({
        name: name.trim(), description: description.trim(), emoji: emoji.trim(),
        url: url.trim(), owner_id: primaryOwner,
      }).eq("id", editing.id);
      if (error) { toast.error("Kunde inte uppdatera: " + error.message); return; }
      await syncOwners(editing.id, selectedOwners);
      await syncDepartments(editing.id, selectedDepartments);
      toast.success("Verktyg uppdaterat");
    } else {
      const { data: inserted, error } = await supabase.from("tools" as any).insert({
        name: name.trim(), description: description.trim(), emoji: emoji.trim(),
        url: url.trim(), sort_order: tools.length, owner_id: primaryOwner,
      }).select("id").single();
      if (error || !inserted) { toast.error("Kunde inte skapa: " + (error?.message ?? "okänt fel")); return; }
      await syncOwners((inserted as any).id, selectedOwners);
      await syncDepartments((inserted as any).id, selectedDepartments);
      toast.success("Verktyg skapat");
    }
    setDialogOpen(false);
    fetchAll();
  };


  const handleDelete = async (id: string) => {
    await supabase.from("tools" as any).delete().eq("id", id);
    toast.success("Verktyg borttaget");
    setConfirmDelete(null);
    fetchAll();
  };

  const handleToggleActive = async (tool: Tool) => {
    await supabase.from("tools" as any).update({ is_active: !tool.is_active }).eq("id", tool.id);
    setTools(prev => prev.map(t => t.id === tool.id ? { ...t, is_active: !t.is_active } : t));
  };

  const MAX_STARRED = 8;
  const starredCount = tools.filter(t => t.is_starred).length;

  const handleToggleStar = async (tool: Tool) => {
    if (!tool.is_starred && starredCount >= MAX_STARRED) {
      toast.error(`Max ${MAX_STARRED} verktyg kan visas i snabbåtkomst`);
      return;
    }
    await supabase.from("tools" as any).update({ is_starred: !tool.is_starred }).eq("id", tool.id);
    setTools(prev => prev.map(t => t.id === tool.id ? { ...t, is_starred: !t.is_starred } : t));
  };

  const toggleOwner = (id: string) =>
    setSelectedOwners(prev => prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]);
  const toggleDepartment = (id: string) =>
    setSelectedDepartments(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tools.findIndex(t => t.id === active.id);
    const newIndex = tools.findIndex(t => t.id === over.id);
    const reordered = arrayMove(tools, oldIndex, newIndex);
    setTools(reordered);
    for (let i = 0; i < reordered.length; i++) {
      await supabase.from("tools" as any).update({ sort_order: i }).eq("id", reordered[i].id);
    }
  }, [tools]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const canSave = !!name.trim() && !!url.trim() && selectedOwners.length > 0;

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
                key={tool.id} tool={tool} departments={departments}
                onToggleStar={handleToggleStar} onToggleActive={handleToggleActive}
                onEdit={openEdit} onDelete={setConfirmDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Dialog open={dialogOpen} onOpenChange={v => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
            <div>
              <Label>Systemägare <span className="text-destructive">*</span></Label>
              <div className="mt-1.5 border border-border rounded-md p-2 space-y-3 max-h-64 overflow-y-auto">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    SHF-anställda
                  </p>
                  <div className="space-y-1.5">
                    {profiles.map(p => {
                      const key = `profile:${p.id}`;
                      return (
                        <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                          <Checkbox
                            checked={selectedOwners.includes(key)}
                            onCheckedChange={() => toggleOwner(key)}
                          />
                          <span>{p.full_name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="border-t border-border pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Externa kontakter
                  </p>
                  {externalContacts.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Inga externa kontakter ännu. Lägg till under Administration → Externa kontakter.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {externalContacts.map(c => {
                        const key = `external:${c.id}`;
                        return (
                          <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                            <Checkbox
                              checked={selectedOwners.includes(key)}
                              onCheckedChange={() => toggleOwner(key)}
                            />
                            <span>
                              {c.full_name}
                              {c.company_name && (
                                <span className="text-muted-foreground"> · {c.company_name}</span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">En eller flera ansvariga — minst en krävs.</p>
            </div>
            <div>
              <Label>Avdelningar som använder verktyget</Label>
              <div className="mt-1.5 border border-border rounded-md p-2 space-y-1.5 max-h-48 overflow-y-auto">
                {departments.map(d => (
                  <label key={d.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedDepartments.includes(d.id)}
                      onCheckedChange={() => toggleDepartment(d.id)}
                    />
                    <span>{d.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Används senare i onboarding-processen.</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Avbryt</Button>
              <Button onClick={handleSave} disabled={!canSave}>
                {editing ? "Spara" : "Lägg till"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
