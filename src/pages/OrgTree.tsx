import { useEffect, useState, useCallback, DragEvent } from "react";
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
  const [zoom, setZoom] = useState(0.85);

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

  // Find the VD (top-level admin with no manager or manager not in profiles)
  const vd = profiles.find(
    (p) =>
      roleMap[p.user_id] === "admin" &&
      (!p.manager_id || !profiles.some((o) => o.id === p.manager_id))
  );

  // Direct reports to VD
  const vdChildren = vd ? (childrenMap.get(vd.id) ?? []) : [];

  // Split into intermediate managers (managers without subordinates = ledningsstöd)
  // and department heads (managers with subordinates)
  const intermediateManagers = vdChildren.filter((c) => {
    const role = roleMap[c.user_id];
    const hasReports = (childrenMap.get(c.id) ?? []).length > 0;
    return (role === "manager" || role === "admin") && !hasReports;
  });

  const departmentHeads = vdChildren.filter(
    (c) => !intermediateManagers.some((im) => im.id === c.id)
  );

  // Other roots (not under VD)
  const otherRoots = profiles.filter(
    (p) =>
      p.id !== vd?.id &&
      (!p.manager_id || !profiles.some((o) => o.id === p.manager_id)) &&
      !vdChildren.some((vc) => vc.id === p.id)
  );

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
              onClick={() => setZoom(0.85)}
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

        {/* Org chart - full width, scrollable */}
        <div className="overflow-x-auto pb-8">
          <div
            className="flex flex-col items-center gap-0 min-w-max px-8"
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
          >
            {/* VD */}
            {vd && (
              <>
                <OrgCard
                  profile={vd}
                  roleMap={roleMap}
                  draggedId={draggedId}
                  onDragStart={setDraggedId}
                  onDrop={handleDrop}
                />

                {/* Connector down from VD */}
                <div className="w-px h-8 bg-border" />

                {/* Intermediate managers (Christel, Petra) */}
                {intermediateManagers.length > 0 && (
                  <>
                    {intermediateManagers.length > 1 && (
                      <div className="relative flex justify-center">
                        <div
                          className="absolute top-0 h-px bg-border"
                          style={{
                            width: `${(intermediateManagers.length - 1) * 140}px`,
                          }}
                        />
                      </div>
                    )}
                    <div className="flex gap-4 justify-center">
                      {intermediateManagers
                        .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""))
                        .map((p, i) => (
                          <div key={p.id} className="flex flex-col items-center">
                            {intermediateManagers.length > 1 && (
                              <div className="w-px h-0 bg-border" />
                            )}
                            <OrgCard
                              profile={p}
                              roleMap={roleMap}
                              draggedId={draggedId}
                              onDragStart={setDraggedId}
                              onDrop={handleDrop}
                            />
                          </div>
                        ))}
                    </div>

                    {/* Connector down from intermediate to departments */}
                    <div className="w-px h-8 bg-border" />
                  </>
                )}

                {/* Department heads with their teams */}
                {departmentHeads.length > 0 && (
                  <>
                    {/* Horizontal connector bar */}
                    {departmentHeads.length > 1 && (
                      <div className="relative w-full flex justify-center">
                        <div className="flex gap-6">
                          {departmentHeads.map((_, i) => (
                            <div key={i} className="w-36" />
                          ))}
                        </div>
                        <div
                          className="absolute top-0 h-px bg-border"
                          style={{
                            left: `calc(50% - ${((departmentHeads.length - 1) * (144 + 24)) / 2}px)`,
                            right: `calc(50% - ${((departmentHeads.length - 1) * (144 + 24)) / 2}px)`,
                          }}
                        />
                      </div>
                    )}

                    <div className="flex gap-6 items-start">
                      {departmentHeads
                        .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""))
                        .map((head) => (
                          <div key={head.id} className="flex flex-col items-center">
                            <div className="w-px h-6 bg-border" />
                            <OrgBranch
                              profile={head}
                              childrenMap={childrenMap}
                              roleMap={roleMap}
                              draggedId={draggedId}
                              onDragStart={setDraggedId}
                              onDrop={handleDrop}
                            />
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* Other root-level people not under VD */}
            {otherRoots.length > 0 && (
              <div className="flex gap-4 mt-8">
                {otherRoots.map((p) => (
                  <OrgBranch
                    key={p.id}
                    profile={p}
                    childrenMap={childrenMap}
                    roleMap={roleMap}
                    draggedId={draggedId}
                    onDragStart={setDraggedId}
                    onDrop={handleDrop}
                  />
                ))}
              </div>
            )}

            {profiles.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Inga profiler hittades</p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
