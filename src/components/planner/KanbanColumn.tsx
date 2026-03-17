import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import KanbanCard, { type PlannerCard } from "./KanbanCard";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, GripVertical } from "lucide-react";
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
  overlay?: boolean;
}

export default function KanbanColumn({
  column, cards, profileMap, onAddCard, onEditColumn, onDeleteColumn, onCardClick, overlay,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    over,
  } = useSortable({
    id: column.id,
    data: { type: "column", column },
  });

  const style = {
    transform: CSS.Transform.toString(transform ? { ...transform, scaleX: 1, scaleY: 1 } : null),
    transition,
  };

  const cardIds = cards.map(c => c.id);
  const isAtLimit = column.wip_limit !== null && cards.length >= column.wip_limit;
  const isOver = over?.id === column.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col w-72 shrink-0 relative",
        isDragging && "opacity-40",
        overlay && "shadow-2xl ring-2 ring-primary/30 rounded-xl bg-background",
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-2 py-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 opacity-40 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
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
