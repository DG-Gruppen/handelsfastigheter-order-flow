import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Module {
  id: string;
  name: string;
  slug: string;
  route: string;
  icon: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

interface ModuleAccess {
  module_id: string;
  role: string;
  has_access: boolean;
}

interface ModulesContextType {
  modules: Module[];
  accessibleModules: Module[];
  allAccess: ModuleAccess[];
  allPermissions: FullModulePermission[];
  userGroupIds: string[];
  loading: boolean;
  refresh: () => void;
}

const ModulesContext = createContext<ModulesContextType>({
  modules: [],
  accessibleModules: [],
  allAccess: [],
  allPermissions: [],
  userGroupIds: [],
  loading: true,
  refresh: () => {},
});

interface ModulePermission {
  module_id: string;
  grantee_type: string;
  grantee_id: string;
  can_view: boolean;
}

export interface FullModulePermission {
  module_id: string;
  grantee_type: string;
  grantee_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  is_owner: boolean;
}

export function ModulesProvider({ children }: { children: ReactNode }) {
  const { user, roles } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [allAccess, setAllAccess] = useState<ModuleAccess[]>([]);
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [fullPermissions, setFullPermissions] = useState<FullModulePermission[]>([]);
  const [userGroupIds, setUserGroupIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModules = async () => {
    if (!user) {
      setModules([]);
      setAllAccess([]);
      setPermissions([]);
      setUserGroupIds([]);
      setLoading(false);
      return;
    }

    const [modulesRes, accessRes, permRes, groupRes] = await Promise.all([
      supabase.from("modules").select("*").order("sort_order"),
      supabase.from("module_role_access").select("module_id, role, has_access"),
      supabase.from("module_permissions").select("module_id, grantee_type, grantee_id, can_view, can_edit, can_delete, is_owner"),
      supabase.from("group_members").select("group_id").eq("user_id", user.id),
    ]);

    setModules((modulesRes.data as Module[]) ?? []);
    setAllAccess((accessRes.data as ModuleAccess[]) ?? []);
    setPermissions((permRes.data as ModulePermission[]) ?? []);
    setFullPermissions((permRes.data as FullModulePermission[]) ?? []);
    setUserGroupIds((groupRes.data ?? []).map((g: any) => g.group_id));
    setLoading(false);
  };

  useEffect(() => {
    fetchModules();
  }, [user?.id]);

  // Realtime: refresh when module_permissions change
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("module-permissions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "module_permissions" },
        () => fetchModules()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        () => fetchModules()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Memoize accessible modules to prevent unnecessary re-renders downstream
  const accessibleModules = useMemo(() => {
    return modules.filter((m) => {
      if (!m.is_active) return false;

      // Check if user has explicit module_permissions (user or group-level)
      const hasExplicitPermission = permissions.some((p) => {
        if (p.module_id !== m.id || !p.can_view) return false;
        if (p.grantee_type === "user" && p.grantee_id === user?.id) return true;
        if (p.grantee_type === "group" && userGroupIds.includes(p.grantee_id)) return true;
        return false;
      });
      if (hasExplicitPermission) return true;

      // Fall back to role-based access
      const moduleRules = allAccess.filter((a) => a.module_id === m.id);
      // No rules defined → accessible to everyone
      if (moduleRules.length === 0) return true;
      // User has no roles → allow if all defined roles have access
      if (roles.length === 0) {
        return moduleRules.every((a) => a.has_access);
      }
      return roles.some((role) => {
        const rule = moduleRules.find((a) => a.role === role);
        return rule ? rule.has_access : false;
      });
    });
  }, [modules, allAccess, permissions, userGroupIds, roles, user?.id]);

  return (
    <ModulesContext.Provider value={{ modules, accessibleModules, allAccess, allPermissions: fullPermissions, userGroupIds, loading, refresh: fetchModules }}>
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules() {
  return useContext(ModulesContext);
}

export function useModuleAccess(route: string): boolean {
  const { accessibleModules, modules, loading } = useModules();
  if (loading) return true;
  const isRegisteredModule = modules.some((m) => m.route === route);
  if (!isRegisteredModule) return true;
  return accessibleModules.some((m) => m.route === route);
}
