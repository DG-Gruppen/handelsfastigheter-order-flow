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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group rounded-xl border border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing select-none touch-none overflow-hidden",
        isDragging && "opacity-40 rotate-2 scale-105",
        overlay && "shadow-xl rotate-2 scale-105 ring-2 ring-primary/30"
      )}
      onClick={onClick}
    >
      {/* Cover color strip */}
      {card.cover_color && (
        <div className="h-2 w-full" style={{ backgroundColor: card.cover_color }} />
      )}

      <div className="p-3">
      {/* Labels */}
      {card.labels && card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.labels.map(label => (
            <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
              {label}
            </Badge>
          ))}
        </div>
      )}

      {/* Title with priority dot */}
      <div className="flex items-start gap-1.5">
        <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", pri.dot)} title={pri.label} />
        <p className="text-sm font-medium text-foreground leading-snug">{card.title}</p>
      </div>

      {/* Footer: badges row */}
      <div className="flex items-center justify-between mt-2.5 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Due date badge */}
          {card.due_date && (
            <span className={cn(
              "flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5",
              card.due_done
                ? "bg-accent/10 text-accent font-medium"
                : isOverdue
                  ? "bg-destructive/10 text-destructive font-medium"
                  : "text-muted-foreground"
            )}>
              <Calendar className="h-3 w-3" />
              {new Date(card.due_date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
            </span>
          )}

          {/* Description icon */}
          {hasDescription && (
            <span className="text-muted-foreground" title="Har beskrivning">
              <FileText className="h-3 w-3" />
            </span>
          )}

          {/* Checklist progress */}
          {hasChecklist && (
            <span className={cn(
              "flex items-center gap-1 text-[10px]",
              checklistSummary.checked === checklistSummary.total
                ? "text-accent font-medium"
                : "text-muted-foreground"
            )}>
              <CheckSquare className="h-3 w-3" />
              {checklistSummary.checked}/{checklistSummary.total}
            </span>
          )}
        </div>

        {/* Assignee / Reporter */}
        <div className="flex items-center gap-1.5">
          {reporterName && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[80px]" title={`Skapad av ${reporterName}`}>
              {reporterName.split(" ")[0]}
            </span>
          )}
          {initials && (
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}
