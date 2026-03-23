import { memo, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import KanbanCard, { type PlannerCard, type ChecklistSummary } from "./KanbanCard";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, GripVertical, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  totalCardCount?: number;
  profileMap: Record<string, string>;
  checklistSummaries?: Record<string, ChecklistSummary>;
  attachmentCounts?: Record<string, number>;
  onAddCard: () => void;
  onEditColumn: () => void;
  onDeleteColumn: () => void;
  onCardClick: (card: PlannerCard) => void;
  overlay?: boolean;
}

export default function KanbanColumn({
  column, cards, totalCardCount, profileMap, checklistSummaries, attachmentCounts, onAddCard, onEditColumn, onDeleteColumn, onCardClick, overlay,
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
  // Use totalCardCount (all cards, not just filtered) for WIP limit check
  const actualCount = totalCardCount ?? cards.length;
  const isAtLimit = column.wip_limit !== null && actualCount >= column.wip_limit;
  const isOverLimit = column.wip_limit !== null && actualCount > column.wip_limit;
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
            aria-label={`Dra för att flytta kolumnen ${column.name}`}
            className="p-0.5 opacity-40 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {column.color && (
            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
          )}
          <h3 className="text-sm font-semibold text-foreground truncate">{column.name}</h3>
          <span className={cn(
            "text-xs tabular-nums font-medium",
            isOverLimit ? "text-destructive" : isAtLimit ? "text-amber-500" : "text-muted-foreground"
          )}>
            {actualCount}{column.wip_limit !== null ? `/${column.wip_limit}` : ""}
          </span>
          {isOverLimit && (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {isAtLimit ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50" onClick={onAddCard}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                WIP-gräns nådd ({column.wip_limit} kort)
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddCard}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
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
          isOverLimit && "bg-destructive/5 border-destructive/20",
          !isOverLimit && isAtLimit && "bg-amber-500/5 border-amber-500/20"
        )}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <KanbanCard
              key={card.id}
              card={card}
              assigneeName={card.assignee_id ? profileMap[card.assignee_id] : undefined}
              reporterName={profileMap[card.reporter_id]}
              onClick={() => onCardClick(card)}
              checklistSummary={checklistSummaries?.[card.id]}
              attachmentCount={attachmentCounts?.[card.id]}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
