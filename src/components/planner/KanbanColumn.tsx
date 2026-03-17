import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import KanbanCard, { type PlannerCard } from "./KanbanCard";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export interface PlannerColumn {
  id: string;
  board_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  wip_limit: number | null;
}

interface Props {
  column: PlannerColumn;
  cards: PlannerCard[];
  profileMap: Record<string, string>;
  onAddCard: () => void;
  onEditColumn: () => void;
  onDeleteColumn: () => void;
  onCardClick: (card: PlannerCard) => void;
}

export default function KanbanColumn({
  column, cards, profileMap, onAddCard, onEditColumn, onDeleteColumn, onCardClick,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", column },
  });

  const cardIds = cards.map(c => c.id);
  const isAtLimit = column.wip_limit !== null && cards.length >= column.wip_limit;

  return (
    <div className="flex flex-col w-72 shrink-0 relative">
      {/* Column header */}
      <div className="flex items-center justify-between px-2 py-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {column.color && (
            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
          )}
          <h3 className="text-sm font-semibold text-foreground truncate">{column.name}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {cards.length}{column.wip_limit !== null ? `/${column.wip_limit}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddCard}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50">
              <DropdownMenuItem onClick={onEditColumn}>Redigera kolumn</DropdownMenuItem>
              <DropdownMenuItem onClick={onDeleteColumn} className="text-destructive">Ta bort kolumn</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Card list */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-xl p-2 space-y-2 min-h-[120px] transition-colors",
          "bg-muted/30 border border-transparent",
          isOver && "bg-primary/5 border-primary/20",
          isAtLimit && "bg-warning/5 border-warning/20"
        )}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <KanbanCard
              key={card.id}
              card={card}
              assigneeName={card.assignee_id ? profileMap[card.assignee_id] : undefined}
              onClick={() => onCardClick(card)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
