import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, AlertTriangle, ArrowUp, ArrowDown, Minus, FileText, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlannerCard {
  id: string;
  column_id: string;
  board_id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  assignee_id: string | null;
  reporter_id: string;
  due_date: string | null;
  due_done: boolean;
  labels: string[] | null;
  cover_color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistSummary {
  total: number;
  checked: number;
}

interface Props {
  card: PlannerCard;
  assigneeName?: string;
  reporterName?: string;
  onClick: () => void;
  overlay?: boolean;
  checklistSummary?: ChecklistSummary;
}

const priorityConfig = {
  urgent: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", dot: "bg-destructive", label: "Brådskande" },
  high: { icon: ArrowUp, color: "text-destructive", bg: "bg-destructive/10", dot: "bg-destructive", label: "Hög" },
  medium: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted", dot: "bg-warning", label: "Medium" },
  low: { icon: ArrowDown, color: "text-accent", bg: "bg-accent/10", dot: "bg-accent", label: "Låg" },
};

export default function KanbanCard({ card, assigneeName, reporterName, onClick, overlay, checklistSummary }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const pri = priorityConfig[card.priority];
  const PriIcon = pri.icon;

  const initials = assigneeName
    ? assigneeName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : null;

  const isOverdue = card.due_date && !card.due_done && new Date(card.due_date) < new Date();
  const hasDescription = !!card.description?.trim();
  const hasChecklist = checklistSummary && checklistSummary.total > 0;

  // Label colors for colored pills (cycle through)
  const labelColors = [
    "bg-accent", "bg-warning", "bg-primary", "bg-destructive",
    "hsl(280 60% 50%)", "hsl(330 70% 50%)",
  ];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group rounded-lg border border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing select-none touch-none overflow-hidden",
        isDragging && "opacity-40 rotate-2 scale-105",
        overlay && "shadow-xl rotate-2 scale-105 ring-2 ring-primary/30"
      )}
      onClick={onClick}
    >
      {/* Cover block */}
      {card.cover_color && (
        <div className="h-9 w-full rounded-t-lg" style={{ backgroundColor: card.cover_color }} />
      )}

      <div className="px-2.5 pt-2 pb-2">
        {/* Label pills (colored dots, no text) */}
        {card.labels && card.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {card.labels.map((label, i) => {
              const c = labelColors[i % labelColors.length];
              const isTw = c.startsWith("bg-");
              return (
                <span
                  key={label}
                  title={label}
                  className={cn("h-2 w-10 rounded-full", isTw && c)}
                  style={!isTw ? { backgroundColor: c } : undefined}
                />
              );
            })}
          </div>
        )}

        {/* Title */}
        <p className="text-[13px] font-normal text-foreground leading-snug mb-1.5">{card.title}</p>

        {/* Footer */}
        {(card.due_date || hasDescription || hasChecklist || initials) && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Due date badge */}
              {card.due_date && (
                <span className={cn(
                  "flex items-center gap-1 text-[11px] rounded-sm px-1.5 py-0.5 font-medium",
                  card.due_done
                    ? "bg-accent text-accent-foreground"
                    : isOverdue
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-muted text-muted-foreground"
                )}>
                  <Calendar className="h-3 w-3" />
                  {new Date(card.due_date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
                </span>
              )}

              {/* Checklist progress */}
              {hasChecklist && (
                <span className={cn(
                  "flex items-center gap-1 text-[11px]",
                  checklistSummary.checked === checklistSummary.total
                    ? "text-accent font-medium"
                    : "text-muted-foreground"
                )}>
                  <CheckSquare className="h-3 w-3" />
                  {checklistSummary.checked}/{checklistSummary.total}
                </span>
              )}

              {/* Description icon */}
              {hasDescription && (
                <span className="text-muted-foreground" title="Har beskrivning">
                  <FileText className="h-3 w-3" />
                </span>
              )}
            </div>

            {/* Assignee avatar */}
            {initials && (
              <Avatar className="h-6 w-6 border-2 border-card">
                <AvatarFallback className="text-[9px] font-semibold bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
