import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import OrgChartCanvas from "@/components/OrgChart/OrgChartCanvas";
import OrgCardMenu from "@/components/OrgChart/OrgCardMenu";
import OrgSettingsModal from "@/components/OrgChart/OrgSettingsModal";
import { toast } from "sonner";
import type { OrgNode, DropAction } from "@/components/OrgChart/OrgChartCanvas";

interface OrgProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  manager_id: string | null;
  title_override?: string | null;
  is_staff?: boolean | null;
  sort_order?: number | null;
}

interface RoleMap { [userId: string]: string; }

interface ColorSettings {
  color_root: string;
  color_staff: string;
  color_manager: string;
  color_employee: string;
}

const DEFAULT_COLORS: ColorSettings = {
  color_root: "primary",
  color_staff: "accent",
  color_manager: "blue,green,amber",
  color_employee: "muted",
};

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

interface DeptInfo {
  id: string;
  name: string;
  parent_id: string | null;
  color: string | null;
}

interface BuildResult {
  tree: OrgNode | null;
  unassigned: OrgNode[];
}

function buildOrgTree(profiles: OrgProfile[], roleMap: RoleMap, colorSettings: ColorSettings, deptList: DeptInfo[]): BuildResult {
  if (!profiles.length) return { tree: null, unassigned: [] };

  // Build dept name → info map
  const deptByName = new Map(deptList.map(d => [d.name, d]));
  const deptDisplayName = (deptName: string): string => {
    const dept = deptByName.get(deptName);
    if (dept?.parent_id) {
      const parent = deptList.find(d => d.id === dept.parent_id);
      if (parent) return `${parent.name} › ${deptName}`;
    }
    return deptName;
  };
  const deptColor = (deptName: string): string | null => {
    const dept = deptByName.get(deptName);
    return dept?.color ?? null;
  };

  const managerColors = colorSettings.color_manager.split(",").filter(Boolean);
  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const childrenByManager = new Map<string | null, OrgProfile[]>();

  for (const p of profiles) {
    const managerId = p.manager_id && profileMap.has(p.manager_id) ? p.manager_id : null;
    if (!childrenByManager.has(managerId)) childrenByManager.set(managerId, []);
    childrenByManager.get(managerId)!.push(p);
  }

  const roots = (childrenByManager.get(null) ?? []).sort((a, b) => {
    const rp = (uid: string) => roleMap[uid] === "admin" ? 0 : roleMap[uid] === "manager" ? 1 : 2;
    const diff = rp(a.user_id) - rp(b.user_id);
    if (diff !== 0) return diff;
    return (a.full_name || "").localeCompare(b.full_name || "");
  });

  let colorIdx = 0;

  function toNode(profile: OrgProfile, forceType?: OrgNode["type"]): OrgNode {
    const role = roleMap[profile.user_id] || "employee";
    const children = (childrenByManager.get(profile.id) ?? [])
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.full_name || "").localeCompare(b.full_name || ""));

    const type: OrgNode["type"] = forceType || "line";
    let color: string;

    if (type === "root") {
      color = colorSettings.color_root;
    } else if (type === "staff") {
      color = colorSettings.color_staff;
    } else if (role === "admin" || role === "manager") {
      color = managerColors[colorIdx++ % managerColors.length] || "blue";
    } else {
      color = colorSettings.color_employee;
    }

    const posLabel = profile.title_override
      || (role === "admin" ? "VD / Admin" : role === "manager" ? (profile.department ? `${profile.department}chef` : "Chef") : "Anställd");

    return {
      id: profile.id,
      userId: profile.user_id,
      name: profile.full_name || profile.email,
      position: posLabel,
      dept: profile.department ? deptDisplayName(profile.department) : "",
      avatar: getInitials(profile.full_name || "?"),
      color,
      type,
      children: children.map(c => {
        // Explicit is_staff flag takes priority; otherwise auto-detect (childless direct report = staff)
        const isStaffExplicit = c.is_staff;
        const isChildless = (childrenByManager.get(c.id) ?? []).length === 0;
        if (type === "root" && isChildless) {
          if (isStaffExplicit === true || (isStaffExplicit == null)) {
            return toNode(c, "staff");
          }
        }
        return toNode(c);
      }),
    };
  }

  // Pick the root with the most descendants (the real VD), not just first admin alphabetically
  const adminRoots = roots.filter(r => roleMap[r.user_id] === "admin");
  let primaryRoot: OrgProfile | undefined;
  if (adminRoots.length > 1) {
    // The admin with children is the real root; others go to unassigned
    primaryRoot = adminRoots.reduce((best, cur) => {
      const bestChildren = (childrenByManager.get(best.id) ?? []).length;
      const curChildren = (childrenByManager.get(cur.id) ?? []).length;
      return curChildren > bestChildren ? cur : best;
    });
  } else {
    primaryRoot = adminRoots[0] || roots[0];
  }
  if (!primaryRoot) return { tree: null, unassigned: [] };

  const rootNode = toNode(primaryRoot, "root");

  // Other roots without manager: those that have children go into tree, rest are unassigned
  const unassigned: OrgNode[] = [];
  for (const r of roots.filter(r => r.id !== primaryRoot.id)) {
    const hasChildren = (childrenByManager.get(r.id) ?? []).length > 0;
    if (hasChildren) {
      rootNode.children.push(toNode(r));
    } else {
      unassigned.push(toNode(r));
    }
  }

  return { tree: rootNode, unassigned };
}

export default function OrgTree() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const isAdmin = roles.includes("admin");
  const [profiles, setProfiles] = useState<OrgProfile[]>([]);
  const [roleMap, setRoleMap] = useState<RoleMap>({});
  const [colorSettings, setColorSettings] = useState<ColorSettings>(DEFAULT_COLORS);
  const [departments, setDepartments] = useState<string[]>([]);
  const [deptList, setDeptList] = useState<DeptInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardMenu, setCardMenu] = useState<{ profileId: string; x: number; y: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAdmin) { navigate("/dashboard"); return; }
    fetchData();

    const channel = supabase
      .channel('org-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        // Debounce realtime updates to avoid flickering during batch operations
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchData(), 500);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isAdmin]);

  const fetchData = async () => {
    const [profilesRes, rolesRes, settingsRes, deptsRes] = await Promise.all([
      supabase.from("profiles").select("id, user_id, full_name, email, department, manager_id, title_override, is_staff, sort_order"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("org_chart_settings").select("setting_key, setting_value"),
      supabase.from("departments").select("id, name, parent_id, color").order("name"),
    ]);
    setProfiles((profilesRes.data as OrgProfile[]) ?? []);
    const rm: RoleMap = {};
    for (const r of (rolesRes.data ?? []) as { user_id: string; role: string }[]) {
      rm[r.user_id] = r.role;
    }
    setRoleMap(rm);

    const cs = { ...DEFAULT_COLORS };
    for (const s of (settingsRes.data as any[]) ?? []) {
      if (s.setting_key in cs) (cs as any)[s.setting_key] = s.setting_value;
    }
    setColorSettings(cs);
    const deptsData = (deptsRes.data as any[]) ?? [];
    setDepartments(deptsData.map(d => d.name));
    setDeptList(deptsData as DeptInfo[]);

    setLoading(false);
  };

  const handleMove = useCallback(async (movedNodeId: string, targetId: string, action: DropAction) => {
    try {
      if (action === "move_under") {
        await supabase.from("profiles").update({ manager_id: targetId } as any).eq("id", movedNodeId);
      } else if (action === "swap") {
        const movedProfile = profiles.find(p => p.id === movedNodeId);
        const targetProfile = profiles.find(p => p.id === targetId);
        if (!movedProfile || !targetProfile) throw new Error("Profile not found");
        // Swap parents
        await Promise.all([
          supabase.from("profiles").update({ manager_id: targetProfile.manager_id } as any).eq("id", movedNodeId),
          supabase.from("profiles").update({ manager_id: movedProfile.manager_id } as any).eq("id", targetId),
        ]);
        // Swap children so subtrees follow
        const movedChildren = profiles.filter(p => p.manager_id === movedNodeId);
        const targetChildren = profiles.filter(p => p.manager_id === targetId);
        const childUpdates = [
          ...movedChildren.map(c => supabase.from("profiles").update({ manager_id: targetId } as any).eq("id", c.id)),
          ...targetChildren.map(c => supabase.from("profiles").update({ manager_id: movedNodeId } as any).eq("id", c.id)),
        ];
        if (childUpdates.length) await Promise.all(childUpdates);
      } else if (action === "place_above") {
        const targetProfile = profiles.find(p => p.id === targetId);
        if (!targetProfile) throw new Error("Profile not found");
        await Promise.all([
          supabase.from("profiles").update({ manager_id: targetProfile.manager_id } as any).eq("id", movedNodeId),
          supabase.from("profiles").update({ manager_id: movedNodeId } as any).eq("id", targetId),
        ]);
      } else if (action === "place_beside") {
        // Place beside: give the moved node the same parent and staff status as the target
        const targetProfile = profiles.find(p => p.id === targetId);
        if (!targetProfile) throw new Error("Profile not found");
        // Determine if target is staff in the tree
        const targetIsStaff = targetProfile.is_staff === true
          || (targetProfile.is_staff == null
            && targetProfile.manager_id
            && profiles.find(p => p.id === targetProfile.manager_id && !p.manager_id) // target's parent is root
            && !profiles.some(p => p.manager_id === targetId)); // target has no children
        await supabase.from("profiles").update({
          manager_id: targetProfile.manager_id,
          is_staff: targetIsStaff ? true : false,
        } as any).eq("id", movedNodeId);
      } else if (action === "reorder_before") {
        // Reorder: place moved node just before target within the same parent
        const targetProfile = profiles.find(p => p.id === targetId);
        if (!targetProfile) throw new Error("Profile not found");
        // Get siblings sorted by current sort_order
        const siblings = profiles
          .filter(p => p.manager_id === targetProfile.manager_id)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.full_name || "").localeCompare(b.full_name || ""));
        // Build new order: insert moved before target
        const reordered = siblings.filter(s => s.id !== movedNodeId);
        const targetIdx = reordered.findIndex(s => s.id === targetId);
        const movedProfile = profiles.find(p => p.id === movedNodeId);
        if (movedProfile) {
          reordered.splice(targetIdx, 0, movedProfile);
        }
        // Update sort_order for all siblings
        const updates = reordered.map((s, i) =>
          supabase.from("profiles").update({ sort_order: i } as any).eq("id", s.id)
        );
        await Promise.all(updates);
      }
      toast.success("Organisationen uppdaterad");
      fetchData();
    } catch {
      toast.error("Kunde inte uppdatera organisationen");
      fetchData();
    }
  }, [profiles]);

  const handleKebabClick = useCallback((nodeId: string, screenX: number, screenY: number) => {
    setCardMenu({ profileId: nodeId, x: screenX, y: screenY });
  }, []);

  const { tree, unassigned } = buildOrgTree(profiles, roleMap, colorSettings, deptList);
  const menuProfile = cardMenu ? profiles.find(p => p.id === cardMenu.profileId) : null;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!tree) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Inga profiler hittades
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="animate-fade-in relative" style={{ height: "calc(100vh - 80px)" }}>
        <OrgChartCanvas
          key={profiles.length + '-' + profiles.map(p => p.sort_order).join(',')}
          initialTree={tree}
          unassignedNodes={unassigned}
          onMoveNode={handleMove}
          onKebabClick={handleKebabClick}
          onSettingsClick={() => setShowSettings(true)}
        />
      </div>

      {cardMenu && menuProfile && (
        <OrgCardMenu
          profileId={cardMenu.profileId}
          currentName={menuProfile.full_name}
          currentDepartment={menuProfile.department || ""}
          currentTitleOverride={menuProfile.title_override || null}
          departments={departments}
          screenX={cardMenu.x}
          screenY={cardMenu.y}
          onClose={() => setCardMenu(null)}
          onUpdated={() => { setCardMenu(null); fetchData(); }}
        />
      )}

      {showSettings && (
        <OrgSettingsModal
          onClose={() => setShowSettings(false)}
          onUpdated={fetchData}
        />
      )}
    </AppLayout>
  );
}
