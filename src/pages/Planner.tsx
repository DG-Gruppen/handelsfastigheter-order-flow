import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  DndContext, closestCorners, DragOverlay,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import BoardSelector from "@/components/planner/BoardSelector";
import KanbanColumn, { type PlannerColumn } from "@/components/planner/KanbanColumn";
import KanbanCard, { type PlannerCard } from "@/components/planner/KanbanCard";
import CardDetailDialog from "@/components/planner/CardDetailDialog";
import ColumnDialog from "@/components/planner/ColumnDialog";
import { Button } from "@/components/ui/button";
import { Plus, Kanban } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface Board {
  id: string;
  name: string;
  description: string;
  created_by: string;
  is_archived: boolean;
  sort_order: number;
}

interface Profile {
  user_id: string;
  full_name: string;
}

export default function Planner() {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [columns, setColumns] = useState<PlannerColumn[]>([]);
  const [cards, setCards] = useState<PlannerCard[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<PlannerCard | null>(null);
  const [defaultColumnId, setDefaultColumnId] = useState<string | undefined>();
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<PlannerColumn | null>(null);

  // DnD
  const [activeCard, setActiveCard] = useState<PlannerCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach(p => { m[p.user_id] = p.full_name; });
    return m;
  }, [profiles]);

  // Fetch boards
  const fetchBoards = useCallback(async () => {
    const { data } = await supabase
      .from("planner_boards" as any)
      .select("*")
      .order("sort_order");
    const b = ((data as unknown) as Board[]) ?? [];
    setBoards(b);
    if (b.length > 0 && !activeBoardId) {
      setActiveBoardId(b[0].id);
    }
    setLoading(false);
  }, [activeBoardId]);

  // Fetch columns & cards for active board
  const fetchBoardData = useCallback(async () => {
    if (!activeBoardId) return;
    const [colRes, cardRes] = await Promise.all([
      supabase.from("planner_columns" as any).select("*").eq("board_id", activeBoardId).order("sort_order"),
      supabase.from("planner_cards" as any).select("*").eq("board_id", activeBoardId).order("sort_order"),
    ]);
    setColumns(((colRes.data as unknown) as PlannerColumn[]) ?? []);
    setCards(((cardRes.data as unknown) as PlannerCard[]) ?? []);
  }, [activeBoardId]);

  // Fetch profiles
  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name").then(({ data }) => {
      setProfiles((data as Profile[]) ?? []);
    });
  }, []);

  useEffect(() => { fetchBoards(); }, []);
  useEffect(() => { fetchBoardData(); }, [activeBoardId]);

  // Realtime subscriptions
  useEffect(() => {
    const boardChannel = supabase
      .channel('planner-boards')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planner_boards' }, () => {
        fetchBoards();
      })
      .subscribe();

    return () => { supabase.removeChannel(boardChannel); };
  }, []);

  useEffect(() => {
    if (!activeBoardId) return;

    const channel = supabase
      .channel(`planner-board-${activeBoardId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'planner_columns',
        filter: `board_id=eq.${activeBoardId}`,
      }, () => { fetchBoardData(); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'planner_cards',
        filter: `board_id=eq.${activeBoardId}`,
      }, () => { fetchBoardData(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeBoardId]);

  // Board operations
  const handleCreateBoard = async (name: string, description: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("planner_boards" as any)
      .insert({ name, description, created_by: user.id, sort_order: boards.length })
      .select()
      .single();
    if (error) { toast.error("Kunde inte skapa board"); return; }
    const newBoard = (data as unknown) as Board;
    setBoards(prev => [...prev, newBoard]);
    setActiveBoardId(newBoard.id);

    // Create default columns
    const defaults = [
      { name: "Att göra", color: "#3b82f6", sort_order: 0 },
      { name: "Pågår", color: "#f59e0b", sort_order: 1 },
      { name: "Klart", color: "#10b981", sort_order: 2 },
    ];
    await supabase
      .from("planner_columns" as any)
      .insert(defaults.map(d => ({ ...d, board_id: newBoard.id })));
    fetchBoardData();
    toast.success("Board skapad");
  };

  const handleUpdateBoard = async (id: string, name: string, description: string) => {
    await supabase.from("planner_boards" as any).update({ name, description }).eq("id", id);
    setBoards(prev => prev.map(b => b.id === id ? { ...b, name, description } : b));
    toast.success("Board uppdaterad");
  };

  const handleDeleteBoard = async (id: string) => {
    await supabase.from("planner_boards" as any).delete().eq("id", id);
    setBoards(prev => prev.filter(b => b.id !== id));
    if (activeBoardId === id) {
      const remaining = boards.filter(b => b.id !== id && !b.is_archived);
      setActiveBoardId(remaining.length > 0 ? remaining[0].id : null);
    }
    toast.success("Board borttagen");
  };

  const handleArchiveBoard = async (id: string) => {
    await supabase.from("planner_boards" as any).update({ is_archived: true }).eq("id", id);
    setBoards(prev => prev.map(b => b.id === id ? { ...b, is_archived: true } : b));
    if (activeBoardId === id) {
      const remaining = boards.filter(b => b.id !== id && !b.is_archived);
      setActiveBoardId(remaining.length > 0 ? remaining[0].id : null);
    }
    toast.success("Board arkiverad");
  };

  const handleSaveColumn = async (data: { name: string; color: string | null; wip_limit: number | null; id?: string }) => {
    if (data.id) {
      await supabase.from("planner_columns" as any).update({ name: data.name, color: data.color, wip_limit: data.wip_limit }).eq("id", data.id);
      toast.success("Kolumn uppdaterad");
    } else {
      if (!activeBoardId) return;
      await supabase.from("planner_columns" as any).insert({
        name: data.name, color: data.color, wip_limit: data.wip_limit,
        board_id: activeBoardId, sort_order: columns.length,
      });
      toast.success("Kolumn skapad");
    }
    fetchBoardData();
  };

  const handleDeleteColumn = async (id: string) => {
    await supabase.from("planner_columns" as any).delete().eq("id", id);
    toast.success("Kolumn borttagen");
    fetchBoardData();
  };

  // Card operations
  const handleSaveCard = async (data: Partial<PlannerCard> & { id?: string }) => {
    if (data.id) {
      const { id, ...update } = data;
      await supabase.from("planner_cards" as any).update(update).eq("id", id);
      toast.success("Kort uppdaterat");
    } else {
      if (!user || !activeBoardId) return;
      const colCards = cards.filter(c => c.column_id === data.column_id);
      await supabase.from("planner_cards" as any).insert({
        ...data,
        board_id: activeBoardId,
        reporter_id: user.id,
        sort_order: colCards.length,
      });
      toast.success("Kort skapat");
    }
    fetchBoardData();
  };

  const handleDeleteCard = async (id: string) => {
    await supabase.from("planner_cards" as any).delete().eq("id", id);
    toast.success("Kort borttaget");
    fetchBoardData();
  };

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = cards.find(c => c.id === active.id);
    if (card) setActiveCard(card);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeCardData = cards.find(c => c.id === activeId);
    if (!activeCardData) return;

    // Determine target column
    const overCard = cards.find(c => c.id === overId);
    const overColumn = columns.find(c => c.id === overId);
    const targetColumnId = overCard?.column_id ?? overColumn?.id;

    if (!targetColumnId || activeCardData.column_id === targetColumnId) return;

    // Move card to new column
    setCards(prev => prev.map(c =>
      c.id === activeId ? { ...c, column_id: targetColumnId } : c
    ));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeCardData = cards.find(c => c.id === activeId);
    if (!activeCardData) return;

    const overCard = cards.find(c => c.id === overId);
    const overColumn = columns.find(c => c.id === overId);
    const targetColumnId = overCard?.column_id ?? overColumn?.id ?? activeCardData.column_id;

    const columnCards = cards
      .filter(c => c.column_id === targetColumnId)
      .sort((a, b) => a.sort_order - b.sort_order);

    let newOrder: typeof columnCards;
    if (overCard && activeId !== overId) {
      const oldIdx = columnCards.findIndex(c => c.id === activeId);
      const newIdx = columnCards.findIndex(c => c.id === overId);
      if (oldIdx >= 0 && newIdx >= 0) {
        newOrder = arrayMove(columnCards, oldIdx, newIdx);
      } else {
        newOrder = columnCards;
      }
    } else {
      newOrder = columnCards;
    }

    // Batch update sort orders and column
    const updates = newOrder.map((c, i) => ({
      id: c.id,
      column_id: targetColumnId,
      sort_order: i,
      board_id: c.board_id,
      title: c.title,
      reporter_id: c.reporter_id,
    }));

    for (const u of updates) {
      await supabase.from("planner_cards" as any)
        .update({ column_id: u.column_id, sort_order: u.sort_order })
        .eq("id", u.id);
    }

    fetchBoardData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">Planner</h1>
          <p className="text-sm text-muted-foreground">Kanban-board för projektplanering</p>
        </div>
      </div>

      {/* Board tabs */}
      <BoardSelector
        boards={boards}
        activeBoardId={activeBoardId}
        onSelect={setActiveBoardId}
        onCreate={handleCreateBoard}
        onUpdate={handleUpdateBoard}
        onDelete={handleDeleteBoard}
        onArchive={handleArchiveBoard}
      />

      {/* Kanban board */}
      {activeBoardId && columns.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="w-full overflow-x-auto scrollbar-hide">
            <div className="flex gap-4 pb-4 min-h-[60vh]">
              {columns
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(col => {
                  const colCards = cards
                    .filter(c => c.column_id === col.id)
                    .sort((a, b) => a.sort_order - b.sort_order);
                  return (
                    <KanbanColumn
                      key={col.id}
                      column={col}
                      cards={colCards}
                      profileMap={profileMap}
                      onAddCard={() => {
                        setEditingCard(null);
                        setDefaultColumnId(col.id);
                        setCardDialogOpen(true);
                      }}
                      onEditColumn={() => {
                        setEditingColumn(col);
                        setColumnDialogOpen(true);
                      }}
                      onDeleteColumn={() => handleDeleteColumn(col.id)}
                      onCardClick={(card) => {
                        setEditingCard(card);
                        setCardDialogOpen(true);
                      }}
                    />
                  );
                })}

              {/* Add column button */}
              <button
                onClick={() => {
                  setEditingColumn(null);
                  setColumnDialogOpen(true);
                }}
                className="flex flex-col items-center justify-center w-72 shrink-0 min-h-[200px] rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary"
              >
                <Plus className="h-6 w-6 mb-1" />
                <span className="text-sm font-medium">Ny kolumn</span>
              </button>
            </div>
          </div>

          <DragOverlay>
            {activeCard && (
              <KanbanCard
                card={activeCard}
                assigneeName={activeCard.assignee_id ? profileMap[activeCard.assignee_id] : undefined}
                onClick={() => {}}
                overlay
              />
            )}
          </DragOverlay>
        </DndContext>
      ) : activeBoardId ? (
        <div className="text-center py-20">
          <Kanban className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Inga kolumner ännu</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => { setEditingColumn(null); setColumnDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Lägg till kolumn
          </Button>
        </div>
      ) : (
        <div className="text-center py-20">
          <Kanban className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Skapa din första board för att komma igång</p>
        </div>
      )}

      {/* Dialogs */}
      <CardDetailDialog
        card={editingCard}
        columns={columns}
        profiles={profiles}
        open={cardDialogOpen}
        onClose={() => { setCardDialogOpen(false); setEditingCard(null); }}
        onSave={handleSaveCard}
        onDelete={handleDeleteCard}
        defaultColumnId={defaultColumnId}
      />

      <ColumnDialog
        column={editingColumn}
        open={columnDialogOpen}
        onClose={() => { setColumnDialogOpen(false); setEditingColumn(null); }}
        onSave={handleSaveColumn}
      />
    </div>
  );
}
