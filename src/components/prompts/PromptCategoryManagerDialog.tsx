import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Plus, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { usePromptCategories, type PromptCategory } from "@/hooks/usePromptCategories";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BADGE_OPTIONS: { label: string; value: string }[] = [
  { label: "Grå", value: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  { label: "Bärnsten", value: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  { label: "Smaragd", value: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  { label: "Lime", value: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200" },
  { label: "Tealgrön", value: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200" },
  { label: "Himmelsblå", value: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  { label: "Violett", value: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200" },
  { label: "Rosa", value: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200" },
  { label: "Röd", value: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
  { label: "Indigo", value: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200" },
];

export function PromptCategoryManagerDialog({ open, onOpenChange }: Props) {
  const { categories } = usePromptCategories();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newBadge, setNewBadge] = useState(BADGE_OPTIONS[0].value);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["prompt-categories"] });
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0);
    const { error } = await supabase.from("prompt_categories" as any).insert({
      name,
      badge_class: newBadge,
      sort_order: maxOrder + 10,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Kategorin finns redan" : "Kunde inte lägga till");
      return;
    }
    setNewName("");
    refresh();
  };

  const handleRename = async (cat: PromptCategory, name: string) => {
    if (!name.trim() || name === cat.name) return;
    const oldName = cat.name;
    const { error } = await supabase.from("prompt_categories" as any).update({ name: name.trim() }).eq("id", cat.id);
    if (error) { toast.error("Kunde inte byta namn"); return; }
    // Update prompts using the old category name
    await supabase.from("prompts" as any).update({ category: name.trim() }).eq("category", oldName);
    refresh();
    qc.invalidateQueries({ queryKey: ["prompts-data"] });
  };

  const handleBadge = async (cat: PromptCategory, badge_class: string) => {
    const { error } = await supabase.from("prompt_categories" as any).update({ badge_class }).eq("id", cat.id);
    if (error) toast.error("Kunde inte uppdatera färg");
    else refresh();
  };

  const handleDelete = async (cat: PromptCategory) => {
    if (!confirm(`Ta bort kategorin "${cat.name}"? Befintliga prompts behåller etiketten men hamnar i "Övrigt"-vyn.`)) return;
    const { error } = await supabase.from("prompt_categories" as any).delete().eq("id", cat.id);
    if (error) toast.error("Kunde inte ta bort");
    else refresh();
  };

  const move = async (cat: PromptCategory, dir: -1 | 1) => {
    const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((c) => c.id === cat.id);
    const swapWith = sorted[idx + dir];
    if (!swapWith) return;
    const a = supabase.from("prompt_categories" as any).update({ sort_order: swapWith.sort_order }).eq("id", cat.id);
    const b = supabase.from("prompt_categories" as any).update({ sort_order: cat.sort_order }).eq("id", swapWith.id);
    const [r1, r2] = await Promise.all([a, b]);
    if (r1.error || r2.error) toast.error("Kunde inte flytta");
    else refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Redigera kategorier</DialogTitle>
          <DialogDescription>
            Hantera promptkategorier som visas i fliken och vid skapande av nya prompts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {categories.sort((a, b) => a.sort_order - b.sort_order).map((cat, i) => (
            <div key={cat.id} className="flex items-center gap-2 p-2 border rounded-md">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                defaultValue={cat.name}
                onBlur={(e) => handleRename(cat, e.target.value)}
                className="h-9 flex-1 min-w-0"
              />
              <Select value={cat.badge_class} onValueChange={(v) => handleBadge(cat, v)}>
                <SelectTrigger className="h-9 w-[140px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BADGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className={`px-2 py-0.5 rounded text-xs ${o.value}`}>{o.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" onClick={() => move(cat, -1)} disabled={i === 0} title="Upp">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => move(cat, 1)} disabled={i === categories.length - 1} title="Ner">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(cat)} title="Ta bort">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          <div className="border-t pt-3 mt-3 space-y-2">
            <Label>Lägg till kategori</Label>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Namn på ny kategori"
                className="h-10 flex-1 min-w-[150px]"
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              />
              <Select value={newBadge} onValueChange={setNewBadge}>
                <SelectTrigger className="h-10 w-[140px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BADGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className={`px-2 py-0.5 rounded text-xs ${o.value}`}>{o.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAdd} disabled={busy || !newName.trim()} className="h-10">
                <Plus className="h-4 w-4 mr-1" /> Lägg till
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Stäng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
