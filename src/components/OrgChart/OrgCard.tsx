import { DragEvent, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export interface OrgProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  manager_id: string | null;
}

export interface RoleMap {
  [userId: string]: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function OrgCard({
  profile,
  roleMap,
  draggedId,
  onDragStart,
  onDrop,
  compact = false,
}: {
  profile: OrgProfile;
  roleMap: RoleMap;
  draggedId: string | null;
  onDragStart: (id: string) => void;
  onDrop: (targetManagerId: string) => void;
  compact?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const role = roleMap[profile.user_id];
  const isDragged = draggedId === profile.id;

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedId && draggedId !== profile.id) setDragOver(true);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (draggedId && draggedId !== profile.id) onDrop(profile.id);
  };

  const roleBadge =
    role === "admin" ? (
      <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">VD</Badge>
    ) : role === "manager" ? (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-accent/15 text-accent border-accent/20">Chef</Badge>
    ) : (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Anställd</Badge>
    );

  const avatarColors =
    role === "admin"
      ? "bg-primary/10 text-primary"
      : role === "manager"
      ? "bg-accent/10 text-accent"
      : "bg-secondary text-secondary-foreground";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart(profile.id);
      }}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`
        flex flex-col items-center gap-1.5 rounded-xl border bg-card px-4 py-3 shadow-sm transition-all cursor-grab active:cursor-grabbing select-none
        ${compact ? "px-3 py-2" : "px-4 py-3"}
        ${isDragged ? "opacity-40 scale-95" : ""}
        ${dragOver ? "ring-2 ring-primary bg-primary/5 scale-[1.02]" : "hover:shadow-md hover:border-primary/20"}
      `}
    >
      <Avatar className={compact ? "h-8 w-8" : "h-10 w-10"}>
        <AvatarFallback className={`text-xs font-semibold ${avatarColors}`}>
          {getInitials(profile.full_name || "?")}
        </AvatarFallback>
      </Avatar>
      <div className="text-center min-w-0">
        <div className="flex items-center justify-center gap-1.5">
          <span className={`font-medium text-foreground truncate ${compact ? "text-xs" : "text-sm"}`}>
            {profile.full_name || profile.email}
          </span>
        </div>
        {profile.department && (
          <p className={`text-muted-foreground truncate ${compact ? "text-[10px]" : "text-xs"}`}>
            {profile.department}
          </p>
        )}
        <div className="mt-1">{roleBadge}</div>
      </div>
    </div>
  );
}
