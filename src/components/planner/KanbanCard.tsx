import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, FileText, CheckSquare, Paperclip } from "lucide-react";
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
  attachmentCount?: number;
}

const LABEL_COLORS = [
  "bg-accent", "bg-warning", "bg-primary", "bg-destructive",
  "hsl(280 60% 50%)", "hsl(330 70% 50%)",
];

const PRIORITY_BORDER: Record<PlannerCard["priority"], string> = {
  low:    "border-l-[3px] border-l-muted-foreground/30",
  medium: "border-l-[3px] border-l-blue-500",
  high:   "border-l-[3px] border-l-amber-500",
  urgent: "border-l-[3px] border-l-destructive",
};

function getInitials(name?: string) {
  if (!name) return null;
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function KanbanCard({ card, assigneeName, reporterName, onClick, overlay, checklistSummary, attachmentCount }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assigneeInitials = getInitials(assigneeName);
  const reporterInitials = getInitials(reporterName);
  const getDueDateColor = () => {
    if (!card.due_date || card.due_done) return card.due_done ? "done" : "neutral";
    const now = new Date();
    const due = new Date(card.due_date);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 0) return "overdue";
    if (diffDays < 1) return "red";
    if (diffDays < 2) return "orange";
    return "green";
  };
  const dueDateColor = getDueDateColor();
  const hasDescription = !!card.description?.trim();
  const hasChecklist = checklistSummary && checklistSummary.total > 0;
  const hasAttachments = attachmentCount && attachmentCount > 0;

  const hasFooter = card.due_date || hasDescription || hasChecklist || hasAttachments || assigneeInitials;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group rounded-lg border border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing select-none touch-none overflow-hidden",
        PRIORITY_BORDER[card.priority],
        isDragging && "opacity-40 rotate-2 scale-105",
        overlay && "shadow-xl rotate-2 scale-105 ring-2 ring-primary/30"
      )}
      onClick={onClick}
    >
      {/* ── Cover ── */}
      {card.cover_color && (
        <div className="h-10 w-full" style={{ backgroundColor: card.cover_color }} />
      )}

      <div className="px-3 pt-2.5 pb-2.5 space-y-2">
        {/* ── Label pills ── */}
        {card.labels && card.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {card.labels.map((label, i) => {
              const c = LABEL_COLORS[i % LABEL_COLORS.length];
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

        {/* ── Title ── */}
        <p className="text-sm text-foreground leading-snug">{card.title}</p>

        {/* ── Footer ── */}
        {hasFooter && (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {/* Left: badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Due date */}
              {card.due_date && (
                <span className={cn(
                  "flex items-center gap-1 text-[11px] rounded-sm px-1.5 py-0.5 font-medium",
                  dueDateColor === "done" && "bg-accent text-accent-foreground",
                  dueDateColor === "overdue" && "bg-destructive text-destructive-foreground",
                  dueDateColor === "red" && "bg-destructive text-destructive-foreground",
                  dueDateColor === "orange" && "bg-orange-500 text-white",
                  dueDateColor === "green" && "bg-green-600 text-white",
                  dueDateColor === "neutral" && "bg-muted text-muted-foreground"
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

              {/* Attachments */}
              {hasAttachments && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Paperclip className="h-3 w-3" />
                  {attachmentCount}
                </span>
              )}
            </div>

            {/* Right: avatars */}
            <div className="flex items-center -space-x-1.5">
              {reporterInitials && reporterInitials !== assigneeInitials && (
                <Avatar className="h-6 w-6 border-2 border-card">
                  <AvatarFallback className="text-[9px] font-semibold bg-muted text-muted-foreground">
                    {reporterInitials}
                  </AvatarFallback>
                </Avatar>
              )}
              {assigneeInitials && (
                <Avatar className="h-6 w-6 border-2 border-card">
                  <AvatarFallback className="text-[9px] font-semibold bg-primary text-primary-foreground">
                    {assigneeInitials}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
