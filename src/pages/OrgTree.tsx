import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import OrgChartCanvas from "@/components/OrgChart/OrgChartCanvas";
import { toast } from "sonner";
import type { OrgNode, DropAction } from "@/components/OrgChart/OrgChartCanvas";

interface OrgProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  manager_id: string | null;
}

interface RoleMap { [userId: string]: string; }

const MANAGER_COLORS = ["blue", "green", "amber"];

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function buildOrgTree(profiles: OrgProfile[], roleMap: RoleMap): OrgNode | null {
  if (!profiles.length) return null;

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
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

    const type: OrgNode["type"] = forceType || "line";
    let color: string;

    if (type === "root") {
      color = "primary";
    } else if (type === "staff") {
      color = "accent";
    } else if (role === "admin" || role === "manager") {
      color = MANAGER_COLORS[colorIdx++ % MANAGER_COLORS.length];
    } else {
      color = "muted";
    }

    const posLabel = role === "admin" ? "VD / Admin" : role === "manager" ? "Chef" : "Anställd";

    return {
      id: profile.id,
      userId: profile.user_id,
      name: profile.full_name || profile.email,
      position: posLabel,
      dept: profile.department || "",
      avatar: getInitials(profile.full_name || "?"),
      color,
      type,
      children: children.map(c => {
        if (type === "root"
          && (childrenByManager.get(c.id) ?? []).length === 0) {
          return toNode(c, "staff");
        }
        return toNode(c);
      }),
    };
  }

  const adminRoot = roots.find(r => roleMap[r.user_id] === "admin");
  const primaryRoot = adminRoot || roots[0];
  if (!primaryRoot) return null;

  const rootNode = toNode(primaryRoot, "root");

  for (const r of roots.filter(r => r.id !== primaryRoot.id)) {
    rootNode.children.push(toNode(r));
  }

  return rootNode;
}

export default function OrgTree() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const isAdmin = roles.includes("admin");
  const [profiles, setProfiles] = useState<OrgProfile[]>([]);
  const [roleMap, setRoleMap] = useState<RoleMap>({});
  const [loading, setLoading] = useState(true);
  const [treeVersion, setTreeVersion] = useState(0);

  useEffect(() => {
    if (!isAdmin) { navigate("/dashboard"); return; }
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
    setTreeVersion(v => v + 1);
  };

  const handleMove = useCallback(async (movedNodeId: string, targetId: string, action: DropAction) => {
    try {
      if (action === "move_under") {
        // Move movedNode under targetNode
        await supabase.from("profiles").update({ manager_id: targetId } as any).eq("id", movedNodeId);
      } else if (action === "swap") {
        // Swap: each takes the other's parent
        const movedProfile = profiles.find(p => p.id === movedNodeId);
        const targetProfile = profiles.find(p => p.id === targetId);
        if (!movedProfile || !targetProfile) throw new Error("Profile not found");
        await Promise.all([
          supabase.from("profiles").update({ manager_id: targetProfile.manager_id } as any).eq("id", movedNodeId),
          supabase.from("profiles").update({ manager_id: movedProfile.manager_id } as any).eq("id", targetId),
        ]);
      } else if (action === "place_above") {
        // movedNode takes targetNode's parent, targetNode becomes child of movedNode
        const targetProfile = profiles.find(p => p.id === targetId);
        if (!targetProfile) throw new Error("Profile not found");
        await Promise.all([
          supabase.from("profiles").update({ manager_id: targetProfile.manager_id } as any).eq("id", movedNodeId),
          supabase.from("profiles").update({ manager_id: movedNodeId } as any).eq("id", targetId),
        ]);
      }
      toast.success("Organisationen uppdaterad");
      fetchData();
    } catch {
      toast.error("Kunde inte uppdatera organisationen");
      fetchData();
    }
  }, [profiles]);

  const tree = buildOrgTree(profiles, roleMap);

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
        <OrgChartCanvas key={treeVersion} initialTree={tree} onMoveNode={handleMove} />
      </div>
    </AppLayout>
  );
}
