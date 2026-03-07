import { useEffect, useState, useCallback, useRef, DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import OrgCard, { OrgProfile, RoleMap } from "@/components/OrgChart/OrgCard";
import OrgBranch from "@/components/OrgChart/OrgBranch";
import { toast } from "sonner";
import { Building2, Users, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

function buildTree(profiles: OrgProfile[]): Map<string | null, OrgProfile[]> {
  const map = new Map<string | null, OrgProfile[]>();
  for (const p of profiles) {
    const key = p.manager_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}

export default function OrgTree() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const isAdmin = roles.includes("admin");
  const [profiles, setProfiles] = useState<OrgProfile[]>([]);
  const [roleMap, setRoleMap] = useState<RoleMap>({});
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.7);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[draggable="true"]')) return;
    if (e.button === 0 || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001)));
    }
  };

  const resetView = () => {
    setZoom(0.7);
    setPan({ x: 0, y: 0 });
  };

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

  // Find roots: profiles whose manager_id is null or points to a non-existent profile
  const roots = profiles
    .filter((p) => !p.manager_id || !profiles.some((o) => o.id === p.manager_id))
    .sort((a, b) => {
      // Admins first, then managers, then employees
      const rolePriority = (uid: string) => {
        const r = roleMap[uid];
        return r === "admin" ? 0 : r === "manager" ? 1 : 2;
      };
      const diff = rolePriority(a.user_id) - rolePriority(b.user_id);
      if (diff !== 0) return diff;
      return (a.full_name || "").localeCompare(b.full_name || "");
    });

  const handleDrop = useCallback(
    async (targetManagerId: string) => {
      if (!draggedId || draggedId === targetManagerId) return;

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
        {/* Compact centered header + controls */}
        <div className="max-w-md mx-auto mb-4">
          <div className="flex items-center justify-center gap-3 mb-3">
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

          {/* Zoom controls */}
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
              className="h-8 w-8 p-0"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
              className="h-8 w-8 p-0"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetView}
              className="h-8 w-8 p-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Drop zone for root level */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropToRoot}
          className="max-w-sm mx-auto min-h-[1.5rem] rounded-xl border-2 border-dashed border-border/50 p-1 mb-4 transition-colors"
        >
          <p className="text-xs text-muted-foreground text-center py-0.5">
            <Users className="h-3 w-3 inline mr-1 -mt-0.5" />
            Släpp här för toppnivå
          </p>
        </div>

        {/* Pannable canvas */}
        <div
          ref={canvasRef}
          data-canvas
          className="relative overflow-hidden rounded-xl border border-border/50 bg-muted/20"
          style={{ height: "calc(100vh - 220px)", cursor: isPanning ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <div
            className="absolute flex flex-col items-center gap-0 min-w-max"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "top left",
              padding: "2rem",
            }}
          >
            {roots.map((root) => (
              <OrgBranch
                key={root.id}
                profile={root}
                childrenMap={childrenMap}
                roleMap={roleMap}
                draggedId={draggedId}
                onDragStart={setDraggedId}
                onDrop={handleDrop}
              />
            ))}

            {profiles.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Inga profiler hittades</p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
