import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, CheckSquare, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  checklist_id: string;
  text: string;
  checked: boolean;
  sort_order: number;
}

interface Checklist {
  id: string;
  card_id: string;
  title: string;
  sort_order: number;
  items: ChecklistItem[];
}

interface Props {
  cardId: string;
  onRegisterAdd?: (fn: () => void) => void;
}

export interface ChecklistSummary {
  total: number;
  checked: number;
}

export default function CardChecklists({ cardId, onRegisterAdd }: Props) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [collapsedLists, setCollapsedLists] = useState<Set<string>>(new Set());

  const fetchChecklists = useCallback(async () => {
    const { data: clData } = await supabase
      .from("planner_checklists")
      .select("*")
      .eq("card_id", cardId)
      .order("sort_order");

    if (!clData || clData.length === 0) {
      setChecklists([]);
      setLoading(false);
      return;
    }

    const clIds = clData.map((c: any) => c.id);
    const { data: itemData } = await supabase
      .from("planner_checklist_items")
      .select("*")
      .in("checklist_id", clIds)
      .order("sort_order");

    const items = (itemData ?? []) as ChecklistItem[];
    const mapped = clData.map((cl: any) => ({
      ...cl,
      items: items.filter(i => i.checklist_id === cl.id),
    })) as Checklist[];

    setChecklists(mapped);
    setLoading(false);
  }, [cardId]);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  useEffect(() => {
    onRegisterAdd?.(() => addChecklist());
  }, [onRegisterAdd, addChecklist]);

  const addChecklist = useCallback(async () => {
    const { error } = await supabase.from("planner_checklists").insert({
      card_id: cardId,
      title: "Checklista",
      sort_order: checklists.length,
    });
    if (error) { toast.error("Kunde inte skapa checklista"); return; }
    fetchChecklists();
  }, [cardId, checklists.length, fetchChecklists]);

  const deleteChecklist = async (id: string) => {
    await supabase.from("planner_checklists").delete().eq("id", id);
    fetchChecklists();
  };

  const updateChecklistTitle = async (id: string, title: string) => {
    if (!title.trim()) return;
    await supabase.from("planner_checklists").update({ title: title.trim() }).eq("id", id);
    setEditingTitle(null);
    fetchChecklists();
  };

  const addItem = async (checklistId: string) => {
    const text = (newItemTexts[checklistId] ?? "").trim();
    if (!text) return;
    const checklist = checklists.find(c => c.id === checklistId);
    await supabase.from("planner_checklist_items").insert({
      checklist_id: checklistId,
      text,
      sort_order: checklist?.items.length ?? 0,
    });
    setNewItemTexts(prev => ({ ...prev, [checklistId]: "" }));
    fetchChecklists();
  };

  const toggleItem = async (item: ChecklistItem) => {
    // Optimistic update
    setChecklists(prev => prev.map(cl => ({
      ...cl,
      items: cl.items.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i),
    })));
    await supabase.from("planner_checklist_items")
      .update({ checked: !item.checked })
      .eq("id", item.id);
  };

  const deleteItem = async (id: string) => {
    await supabase.from("planner_checklist_items").delete().eq("id", id);
    fetchChecklists();
  };

  const toggleCollapse = (id: string) => {
    setCollapsedLists(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Laddar checklistor...</p>;
  }

  return (
    <div className="space-y-4">
      {checklists.map(cl => {
        const total = cl.items.length;
        const checked = cl.items.filter(i => i.checked).length;
        const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
        const isCollapsed = collapsedLists.has(cl.id);

        return (
          <div key={cl.id} className="space-y-2">
            {/* Checklist header */}
            <div className="flex items-center gap-2">
              <button onClick={() => toggleCollapse(cl.id)} className="p-0.5">
                {isCollapsed
                  ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                }
              </button>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              {editingTitle === cl.id ? (
                <Input
                  autoFocus
                  defaultValue={cl.title}
                  className="h-7 text-sm font-medium"
                  onBlur={e => updateChecklistTitle(cl.id, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") updateChecklistTitle(cl.id, (e.target as HTMLInputElement).value);
                    if (e.key === "Escape") setEditingTitle(null);
                  }}
                />
              ) : (
                <button
                  className="text-sm font-medium text-foreground hover:underline"
                  onClick={() => setEditingTitle(cl.id)}
                >
                  {cl.title}
                </button>
              )}
              {total > 0 && (
                <span className="text-xs text-muted-foreground ml-auto mr-1">
                  {checked}/{total}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:bg-destructive/10"
                onClick={() => deleteChecklist(cl.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            {/* Progress bar */}
            {total > 0 && (
              <Progress value={pct} className="h-1.5" />
            )}

            {/* Items */}
            {!isCollapsed && (
              <div className="space-y-1 pl-6">
                {cl.items.map(item => (
                  <div key={item.id} className="group flex items-center gap-2 py-0.5">
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={() => toggleItem(item)}
                    />
                    <span className={cn(
                      "text-sm flex-1",
                      item.checked && "line-through text-muted-foreground"
                    )}>
                      {item.text}
                    </span>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-destructive transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {/* Add item */}
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newItemTexts[cl.id] ?? ""}
                    onChange={e => setNewItemTexts(prev => ({ ...prev, [cl.id]: e.target.value }))}
                    placeholder="Lägg till objekt..."
                    className="h-7 text-sm flex-1"
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); addItem(cl.id); }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => addItem(cl.id)}
                    disabled={!(newItemTexts[cl.id] ?? "").trim()}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <Button variant="outline" size="sm" onClick={addChecklist} className="w-full">
        <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
        Lägg till checklista
      </Button>
    </div>
  );
}
