import { useEffect, useState, useCallback, DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Users, GripVertical, ChevronRight, ChevronDown, Building2 } from "lucide-react";

interface OrgProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  manager_id: string | null;
}

interface RoleMap {
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

function buildTree(profiles: OrgProfile[]): Map<string | null, OrgProfile[]> {
  const map = new Map<string | null, OrgProfile[]>();
  for (const p of profiles) {
    const key = p.manager_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}

function OrgNode({
  profile,
  childrenMap,
  roleMap,
  draggedId,
  onDragStart,
  onDrop,
  level,
}: {
  profile: OrgProfile;
  childrenMap: Map<string | null, OrgProfile[]>;
  roleMap: RoleMap;
  draggedId: string | null;
  onDragStart: (id: string) => void;
  onDrop: (targetManagerId: string) => void;
  level: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const children = childrenMap.get(profile.id) ?? [];
  const role = roleMap[profile.user_id];
  const isDragged = draggedId === profile.id;

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedId && draggedId !== profile.id) {
      setDragOver(true);
    }
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (draggedId && draggedId !== profile.id) {
      onDrop(profile.id);
    }
  };

  const roleBadge = role === "admin" ? (
    <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">Admin</Badge>
  ) : role === "manager" ? (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-accent/15 text-accent border-accent/20">Chef</Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Anställd</Badge>
  );

  return (
    <div className="select-none">
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart(profile.id);
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          group flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all cursor-grab active:cursor-grabbing
          ${isDragged ? "opacity-40" : ""}
          ${dragOver ? "ring-2 ring-primary bg-primary/5 scale-[1.01]" : "hover:bg-secondary/50"}
        `}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />

        {children.length > 0 ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 p-0.5 rounded hover:bg-secondary"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className={`text-xs font-semibold ${
            role === "admin" ? "bg-primary/10 text-primary" :
            role === "manager" ? "bg-accent/10 text-accent" :
            "bg-secondary text-secondary-foreground"
          }`}>
            {getInitials(profile.full_name || "?")}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {profile.full_name || profile.email}
            </span>
            {roleBadge}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {profile.department && <span>{profile.department}</span>}
            {profile.department && profile.email && <span>·</span>}
            <span className="truncate">{profile.email}</span>
          </div>
        </div>

        {children.length > 0 && (
          <span className="text-xs text-muted-foreground shrink-0">
            {children.length} {children.length === 1 ? "person" : "personer"}
          </span>
        )}
      </div>

      {expanded && children.length > 0 && (
        <div className="ml-6 pl-4 border-l-2 border-border/50 space-y-0.5 mt-0.5">
          {children
            .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""))
            .map((child) => (
              <OrgNode
                key={child.id}
                profile={child}
                childrenMap={childrenMap}
                roleMap={roleMap}
                draggedId={draggedId}
                onDragStart={onDragStart}
                onDrop={onDrop}
                level={level + 1}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default function OrgTree() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const isAdmin = roles.includes("admin");
  const [profiles, setProfiles] = useState<OrgProfile[]>([]);
  const [roleMap, setRoleMap] = useState<RoleMap>({});
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("id, user_id, full_name, email, department, manager_id"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setProfiles((profilesRes.data as OrgProfile[]) ?? []);
    const rm: RoleMap = {};
    for (const r of (rolesRes.data ?? []) as { user_id: string; role: string }[]) {
      rm[r.user_id] = r.role;
    }
    setRoleMap(rm);
    setLoading(false);
  };

  const childrenMap = buildTree(profiles);

  const roots = profiles.filter(
    (p) => !p.manager_id || !profiles.some((other) => other.id === p.manager_id)
  );

  const unassigned = childrenMap.get(null) ?? [];
  const assignedRoots = roots.filter((r) => r.manager_id === null || !profiles.some((o) => o.id === r.manager_id));
  // Deduplicate
  const rootIds = new Set(assignedRoots.map((r) => r.id));

  const handleDrop = useCallback(
    async (targetManagerId: string) => {
      if (!draggedId || draggedId === targetManagerId) return;

      // Prevent circular: can't drop onto own descendant
      const isDescendant = (parentId: string, checkId: string): boolean => {
        const kids = childrenMap.get(parentId) ?? [];
        for (const k of kids) {
          if (k.id === checkId) return true;
          if (isDescendant(k.id, checkId)) return true;
        }
        return false;
      };

      if (isDescendant(draggedId, targetManagerId)) {
        toast.error("Kan inte placera en person under sin egen underordnade");
        setDraggedId(null);
        return;
      }

      // Optimistic update
      setProfiles((prev) =>
        prev.map((p) => (p.id === draggedId ? { ...p, manager_id: targetManagerId } : p))
      );
      setDraggedId(null);

      const { error } = await supabase
        .from("profiles")
        .update({ manager_id: targetManagerId } as any)
        .eq("id", draggedId);

      if (error) {
        toast.error("Kunde inte uppdatera organisationen");
        fetchData();
      } else {
        toast.success("Organisationen uppdaterad");
      }
    },
    [draggedId, childrenMap]
  );

  const handleDropToRoot = (e: DragEvent) => {
    e.preventDefault();
    if (!draggedId) return;

    setProfiles((prev) =>
      prev.map((p) => (p.id === draggedId ? { ...p, manager_id: null } : p))
    );
    setDraggedId(null);

    supabase
      .from("profiles")
      .update({ manager_id: null } as any)
      .eq("id", draggedId)
      .then(({ error }) => {
        if (error) {
          toast.error("Kunde inte uppdatera organisationen");
          fetchData();
        } else {
          toast.success("Personen flyttad till toppnivå");
        }
      });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="animate-fade-up">
        {/* Compact centered header */}
        <div className="max-w-md mx-auto mb-4">
          <div className="flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-lg md:text-xl font-semibold text-foreground">Organisation</h1>
              <p className="text-sm text-muted-foreground">
                Dra och släpp för att ändra struktur
              </p>
            </div>
          </div>
        </div>

        <Card className="glass-card shadow-xl shadow-primary/[0.03] max-w-3xl mx-auto">
          <CardContent className="px-4 md:px-6">
            {/* Drop zone for root level */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={handleDropToRoot}
              className="min-h-[2rem] rounded-xl border-2 border-dashed border-border/50 p-1 mb-2 transition-colors"
            >
              <p className="text-xs text-muted-foreground px-3 py-1">
                <Users className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                Släpp här för att placera på toppnivå
              </p>
            </div>

            <div className="space-y-0.5">
              {assignedRoots
                .sort((a, b) => {
                  const rA = roleMap[a.user_id] ?? "employee";
                  const rB = roleMap[b.user_id] ?? "employee";
                  const order: Record<string, number> = { admin: 0, manager: 1, employee: 2 };
                  return (order[rA] ?? 3) - (order[rB] ?? 3) || (a.full_name || "").localeCompare(b.full_name || "");
                })
                .map((profile) => (
                  <OrgNode
                    key={profile.id}
                    profile={profile}
                    childrenMap={childrenMap}
                    roleMap={roleMap}
                    draggedId={draggedId}
                    onDragStart={setDraggedId}
                    onDrop={handleDrop}
                    level={0}
                  />
                ))}
            </div>

            {profiles.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Inga profiler hittades</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
