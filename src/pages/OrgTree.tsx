import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import OrgChartCanvas, { OrgNode, ColorKey, NodeType } from "@/components/OrgChart/OrgChartCanvas";
import { toast } from "sonner";

interface OrgProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  manager_id: string | null;
}

interface RoleMap { [userId: string]: string; }

const MANAGER_COLORS: ColorKey[] = ["blue", "emerald", "amber"];

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

  function toNode(profile: OrgProfile, forceType?: NodeType): OrgNode {
    const role = roleMap[profile.user_id] || "employee";
    const children = (childrenByManager.get(profile.id) ?? [])
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

    const type: NodeType = forceType || "line";
    let color: ColorKey;

    if (type === "root") {
      color = "cyan";
    } else if (type === "staff") {
      color = "violet";
    } else if (role === "admin" || role === "manager") {
      color = MANAGER_COLORS[colorIdx++ % MANAGER_COLORS.length];
    } else {
      color = "slate";
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
        // Direct children of root with no subordinates and not manager/admin → staff
        if (type === "root"
          && (childrenByManager.get(c.id) ?? []).length === 0
          && roleMap[c.user_id] !== "admin"
          && roleMap[c.user_id] !== "manager") {
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

  // Other orphans become children of primary root
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

  const handleMove = useCallback(async (movedNodeId: string, newParentId: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ manager_id: newParentId } as any)
      .eq("id", movedNodeId);

    if (error) {
      toast.error("Kunde inte uppdatera organisationen");
      fetchData();
    } else {
      toast.success("Organisationen uppdaterad");
    }
  }, []);

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
      <div className="animate-fade-in" style={{ height: "calc(100vh - 80px)" }}>
        <OrgChartCanvas key={treeVersion} initialTree={tree} onMoveNode={handleMove} />
      </div>
    </AppLayout>
  );
}
