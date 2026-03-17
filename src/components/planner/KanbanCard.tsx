import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, GripVertical, AlertTriangle, ArrowUp, ArrowDown, Minus } from "lucide-react";
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
  labels: string[] | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface Props {
  card: PlannerCard;
  assigneeName?: string;
  reporterName?: string;
  onClick: () => void;
  overlay?: boolean;
}

const priorityConfig = {
  urgent: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", dot: "bg-destructive", label: "Brådskande" },
  high: { icon: ArrowUp, color: "text-warning", bg: "bg-warning/10", dot: "bg-warning", label: "Hög" },
  medium: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground", label: "Medium" },
  low: { icon: ArrowDown, color: "text-accent", bg: "bg-accent/10", dot: "bg-accent", label: "Låg" },
};

export default function KanbanCard({ card, assigneeName, reporterName, onClick, overlay }: Props) {
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

  const isOverdue = card.due_date && new Date(card.due_date) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-xl border border-border/60 bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer select-none",
        isDragging && "opacity-40 rotate-2 scale-105",
        overlay && "shadow-xl rotate-2 scale-105 ring-2 ring-primary/30"
      )}
      onClick={onClick}
    >
      {/* Drag handle + priority */}
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 p-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">{card.title}</p>
        </div>
      </div>

      {/* Labels */}
      {card.labels && card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {card.labels.map(label => (
            <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
              {label}
            </Badge>
          ))}
        </div>
      )}

      {/* Footer: priority, due date, reporter, assignee */}
      <div className="flex items-center justify-between mt-2.5 gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("flex items-center gap-0.5 text-[10px] font-medium rounded-md px-1.5 py-0.5", pri.bg, pri.color)}>
            <PriIcon className="h-3 w-3" />
            {pri.label}
          </span>
          {card.due_date && (
            <span className={cn(
              "flex items-center gap-1 text-[10px]",
              isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
            )}>
              <Calendar className="h-3 w-3" />
              {new Date(card.due_date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
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
