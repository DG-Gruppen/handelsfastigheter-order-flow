import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  DndContext, closestCorners, DragOverlay,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import BoardSelector from "@/components/planner/BoardSelector";
import KanbanColumn, { type PlannerColumn } from "@/components/planner/KanbanColumn";
import KanbanCard, { type PlannerCard } from "@/components/planner/KanbanCard";
import CardDetailDialog from "@/components/planner/CardDetailDialog";
import ColumnDialog from "@/components/planner/ColumnDialog";
import { Button } from "@/components/ui/button";
import { Plus, Kanban, History } from "lucide-react";
import BoardActivityLog from "@/components/planner/BoardActivityLog";
import { logPlannerActivity } from "@/components/planner/logActivity";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import PlannerFilters, { EMPTY_FILTERS, type PlannerFilterState } from "@/components/planner/PlannerFilters";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [confirmDeleteColumn, setConfirmDeleteColumn] = useState<PlannerColumn | null>(null);

  // Filters
  const [filters, setFilters] = useState<PlannerFilterState>(EMPTY_FILTERS);

  // DnD
  const [activeCard, setActiveCard] = useState<PlannerCard | null>(null);
  const [activeColumn, setActiveColumn] = useState<PlannerColumn | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach(p => { m[p.user_id] = p.full_name; });
    return m;
  }, [profiles]);

  // Available labels from all cards
  const availableLabels = useMemo(() => {
    const set = new Set<string>();
    cards.forEach(c => c.labels?.forEach(l => set.add(l)));
    return Array.from(set).sort();
  }, [cards]);

  // Filtered cards
  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchDesc = c.description?.toLowerCase().includes(q);
        const matchLabel = c.labels?.some(l => l.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchLabel) return false;
      }
      if (filters.priority && c.priority !== filters.priority) return false;
      if (filters.assignee === "unassigned" && c.assignee_id) return false;
      if (filters.assignee && filters.assignee !== "unassigned" && c.assignee_id !== filters.assignee) return false;
      if (filters.label && !c.labels?.includes(filters.label)) return false;
      return true;
    });
  }, [cards, filters]);

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.sort_order - b.sort_order),
    [columns],
  );

  // Fetch boards
  const fetchBoards = useCallback(async () => {
    const { data } = await supabase
      .from("planner_boards")
      .select("*")
      .order("sort_order");

    const b = (data ?? []) as Board[];
    setBoards(b);
    setActiveBoardId((current) => {
      if (b.length === 0) return null;
      if (current && b.some((board) => board.id === current && !board.is_archived)) {
        return current;
      }
      return b.find((board) => !board.is_archived)?.id ?? null;
    });
    setLoading(false);
  }, []);

  // Fetch columns & cards for active board
  const fetchBoardData = useCallback(async () => {
    if (!activeBoardId) return;

    const [colRes, cardRes] = await Promise.all([
      supabase.from("planner_columns").select("*").eq("board_id", activeBoardId).order("sort_order"),
      supabase.from("planner_cards").select("*").eq("board_id", activeBoardId).order("sort_order"),
    ]);

    setColumns((colRes.data ?? []) as PlannerColumn[]);
    setCards((cardRes.data ?? []) as PlannerCard[]);
  }, [activeBoardId]);

  // Fetch profiles
  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name").then(({ data }) => {
      setProfiles((data as Profile[]) ?? []);
    });
  }, []);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  // Debounced realtime to prevent flicker
  const boardDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const dataDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const suppressBoardRealtimeUntilRef = useRef(0);
  const suppressDataRealtimeUntilRef = useRef(0);

  const suppressBoardRealtime = useCallback((durationMs = 1500) => {
    suppressBoardRealtimeUntilRef.current = Date.now() + durationMs;
  }, []);

  const suppressDataRealtime = useCallback((durationMs = 1500) => {
    suppressDataRealtimeUntilRef.current = Date.now() + durationMs;
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    const boardChannel = supabase
      .channel("planner-boards")
      .on("postgres_changes", { event: "*", schema: "public", table: "planner_boards" }, () => {
        if (Date.now() < suppressBoardRealtimeUntilRef.current) return;
        clearTimeout(boardDebounceRef.current);
        boardDebounceRef.current = setTimeout(() => fetchBoards(), 500);
      })
      .subscribe();

    return () => {
      clearTimeout(boardDebounceRef.current);
      supabase.removeChannel(boardChannel);
    };
  }, [fetchBoards]);

  useEffect(() => {
    if (!activeBoardId) return;

    const channel = supabase
      .channel(`planner-board-${activeBoardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "planner_columns",
          filter: `board_id=eq.${activeBoardId}`,
        },
        () => {
          if (Date.now() < suppressDataRealtimeUntilRef.current) return;
          clearTimeout(dataDebounceRef.current);
          dataDebounceRef.current = setTimeout(() => fetchBoardData(), 500);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "planner_cards",
          filter: `board_id=eq.${activeBoardId}`,
        },
        () => {
          if (Date.now() < suppressDataRealtimeUntilRef.current) return;
          clearTimeout(dataDebounceRef.current);
          dataDebounceRef.current = setTimeout(() => fetchBoardData(), 500);
        },
      )
      .subscribe();

    return () => {
      clearTimeout(dataDebounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [activeBoardId, fetchBoardData]);

  // Board operations
  const handleCreateBoard = async (name: string, description: string) => {
    if (!user) return;
    suppressBoardRealtime();

    const { data, error } = await supabase
      .from("planner_boards")
      .insert({ name, description, created_by: user.id, sort_order: boards.length })
      .select()
      .single();

    if (error) {
      toast.error("Kunde inte skapa board");
      return;
    }

    const newBoard = data as Board;
    setBoards((prev) => [...prev, newBoard]);
    setActiveBoardId(newBoard.id);

    // Create default columns
    suppressDataRealtime(2500);
    const defaults = [
      { name: "Att göra", color: "#3b82f6", sort_order: 0 },
      { name: "Pågår", color: "#f59e0b", sort_order: 1 },
      { name: "Klart", color: "#10b981", sort_order: 2 },
    ];

    await supabase
      .from("planner_columns")
      .insert(defaults.map((d) => ({ ...d, board_id: newBoard.id })));

    fetchBoardData();
    toast.success("Board skapad");

    // Log activity
    logPlannerActivity({ boardId: newBoard.id, userId: user.id, action: "created", entityType: "column", entityName: "Standardkolumner" });
  };

  const handleUpdateBoard = async (id: string, name: string, description: string) => {
    suppressBoardRealtime();
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, name, description } : b)));
    await supabase.from("planner_boards").update({ name, description }).eq("id", id);
    toast.success("Board uppdaterad");
  };

  const handleDeleteBoard = async (id: string) => {
    suppressBoardRealtime();
    setBoards((prev) => prev.filter((b) => b.id !== id));
    if (activeBoardId === id) {
      const remaining = boards.filter((b) => b.id !== id && !b.is_archived);
      setActiveBoardId(remaining.length > 0 ? remaining[0].id : null);
    }
    await supabase.from("planner_boards").delete().eq("id", id);
    toast.success("Board borttagen");
  };

  const handleArchiveBoard = async (id: string) => {
    suppressBoardRealtime();
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, is_archived: true } : b)));
    if (activeBoardId === id) {
      const remaining = boards.filter((b) => b.id !== id && !b.is_archived);
      setActiveBoardId(remaining.length > 0 ? remaining[0].id : null);
    }
    await supabase.from("planner_boards").update({ is_archived: true }).eq("id", id);
    toast.success("Board arkiverad");
  };

  const handleRestoreBoard = async (id: string) => {
    suppressBoardRealtime();
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, is_archived: false } : b)));
    setActiveBoardId(id);
    await supabase.from("planner_boards").update({ is_archived: false }).eq("id", id);
    toast.success("Board återställd");
  };

  const handleSaveColumn = async (data: { name: string; color: string | null; wip_limit: number | null; id?: string }) => {
    suppressDataRealtime();

    if (data.id) {
      await supabase
        .from("planner_columns")
        .update({ name: data.name, color: data.color, wip_limit: data.wip_limit })
        .eq("id", data.id);
      toast.success("Kolumn uppdaterad");
    } else {
      if (!activeBoardId || !user) return;
      await supabase.from("planner_columns").insert({
        name: data.name,
        color: data.color,
        wip_limit: data.wip_limit,
        board_id: activeBoardId,
        sort_order: columns.length,
      });
      toast.success("Kolumn skapad");
      if (user && activeBoardId) {
        logPlannerActivity({ boardId: activeBoardId, userId: user.id, action: "created", entityType: "column", entityName: data.name });
      }
    }

    fetchBoardData();
  };

  const handleDeleteColumn = async (id: string) => {
    suppressDataRealtime();
    await supabase.from("planner_columns").delete().eq("id", id);
    toast.success("Kolumn borttagen");
    fetchBoardData();
  };

  // Card operations
  const handleSaveCard = async (data: Partial<PlannerCard> & { id?: string }) => {
    suppressDataRealtime();

    if (data.id) {
      const { id, ...update } = data;
      await supabase.from("planner_cards").update(update as any).eq("id", id);
      toast.success("Kort uppdaterat");
      if (user && activeBoardId) {
        logPlannerActivity({ boardId: activeBoardId, userId: user.id, action: "updated", entityType: "card", entityName: data.title });
      }
    } else {
      if (!user || !activeBoardId) return;
      const colCards = cards.filter((c) => c.column_id === data.column_id);
      await supabase.from("planner_cards").insert({
        title: data.title!,
        description: data.description ?? "",
        priority: data.priority ?? "medium",
        assignee_id: data.assignee_id ?? null,
        due_date: data.due_date ?? null,
        column_id: data.column_id!,
        labels: data.labels ?? [],
        board_id: activeBoardId,
        reporter_id: user.id,
        sort_order: colCards.length,
      });
      toast.success("Kort skapat");
      if (user && activeBoardId) {
        logPlannerActivity({ boardId: activeBoardId, userId: user.id, action: "created", entityType: "card", entityName: data.title });
      }
    }

    fetchBoardData();
  };

  const handleDeleteCard = async (id: string) => {
    suppressDataRealtime();
    const card = cards.find(c => c.id === id);
    await supabase.from("planner_cards").delete().eq("id", id);
    toast.success("Kort borttaget");
    if (user && activeBoardId && card) {
      logPlannerActivity({ boardId: activeBoardId, userId: user.id, action: "deleted", entityType: "card", entityName: card.title });
    }
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

    suppressDataRealtime(3000);

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
      await supabase.from("planner_cards")
        .update({ column_id: u.column_id, sort_order: u.sort_order })
        .eq("id", u.id);
    }

    // Log move if column changed
    const originalColumn = columns.find(c => c.id === activeCardData.column_id);
    const targetColumn = columns.find(c => c.id === targetColumnId);
    if (user && activeBoardId && activeCardData.column_id !== targetColumnId) {
      logPlannerActivity({
        boardId: activeBoardId,
        userId: user.id,
        action: "moved",
        entityType: "card",
        entityName: activeCardData.title,
        metadata: { from_column: originalColumn?.name, to_column: targetColumn?.name },
      });
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
        {activeBoardId && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <History className="h-3.5 w-3.5" /> Aktivitet
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Aktivitetslogg</SheetTitle>
                <SheetDescription>Senaste ändringar på denna board</SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <BoardActivityLog boardId={activeBoardId} profiles={profiles} />
              </div>
            </SheetContent>
          </Sheet>
        )}
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
        onRestore={handleRestoreBoard}
      />

      {/* Filters */}
      {activeBoardId && columns.length > 0 && (
        <PlannerFilters
          filters={filters}
          onChange={setFilters}
          profiles={profiles}
          availableLabels={availableLabels}
        />
      )}

      {/* Kanban board */}
      {activeBoardId && columns.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="w-full overflow-x-auto kanban-scroll pb-2">
            <div className="flex gap-4 pb-4 min-h-[60vh]">
              {sortedColumns.map((col) => {
                  const colCards = filteredCards
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
                      onDeleteColumn={() => setConfirmDeleteColumn(col)}
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

      {/* Column delete confirm */}
      <AlertDialog open={!!confirmDeleteColumn} onOpenChange={v => !v && setConfirmDeleteColumn(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort kolumn</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort kolumnen <span className="font-semibold">"{confirmDeleteColumn?.name}"</span>? Alla kort i kolumnen raderas permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDeleteColumn) handleDeleteColumn(confirmDeleteColumn.id); setConfirmDeleteColumn(null); }}
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
