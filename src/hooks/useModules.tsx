import { createContext, useContext, useMemo, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

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

async function fetchModulesData(userId: string) {
  const [modulesRes, accessRes, permRes, groupRes] = await Promise.all([
    supabase.from("modules").select("*").order("sort_order"),
    supabase.from("module_role_access").select("module_id, role, has_access"),
    supabase.from("module_permissions").select("module_id, grantee_type, grantee_id, can_view, can_edit, can_delete, is_owner"),
    supabase.from("group_members").select("group_id").eq("user_id", userId),
  ]);

  return {
    modules: (modulesRes.data as Module[]) ?? [],
    allAccess: (accessRes.data as ModuleAccess[]) ?? [],
    permissions: (permRes.data as ModulePermission[]) ?? [],
    fullPermissions: (permRes.data as FullModulePermission[]) ?? [],
    userGroupIds: (groupRes.data ?? []).map((g: { group_id: string }) => g.group_id),
  };
}

export function ModulesProvider({ children }: { children: ReactNode }) {
  const { user, roles, profile, roleOverride } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["modules-data", user?.id, roleOverride?.join(",") ?? "real"],
    queryFn: () => fetchModulesData(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const modules = data?.modules ?? [];
  const allAccess = data?.allAccess ?? [];
  const permissions = data?.permissions ?? [];
  const fullPermissions = data?.fullPermissions ?? [];
  const userGroupIds = data?.userGroupIds ?? [];
  const loading = !user ? false : isLoading;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["modules-data", user?.id] });
  };

  // Realtime: refresh on any permission/membership change.
  // We can't filter on the server because group-level permissions use
  // `grantee_id = group_id`, which doesn't match the user's id directly.
  // The query is cheap and only re-runs when something actually changed.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("module-permissions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "module_permissions" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        () => refresh()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Memoize accessible modules to prevent unnecessary re-renders downstream
  const isExternal = profile?.is_external === true;

  const accessibleModules = useMemo(() => {
    // Admin role is a superuser override – sees everything active
    const isAdmin = roles.includes("admin");

    return modules.filter((m) => {
      if (!m.is_active) return false;
      if (isAdmin) return true;

      // Check if user has explicit module_permissions (user or group-level)
      const hasExplicitPermission = permissions.some((p) => {
        if (p.module_id !== m.id) return false;
        const grantsAccess = p.can_view || (p as FullModulePermission).can_edit || (p as FullModulePermission).can_delete || (p as FullModulePermission).is_owner;
        if (!grantsAccess) return false;
        if (p.grantee_type === "user" && p.grantee_id === user?.id) return true;
        if (p.grantee_type === "group" && userGroupIds.includes(p.grantee_id)) return true;
        return false;
      });
      if (hasExplicitPermission) return true;

      // External users ONLY get modules with explicit permissions – no fallback
      if (isExternal) return false;

      // If module has ANY explicit permissions defined, it's restricted –
      // only the listed grantees may access it. Don't fall through to role access.
      const hasAnyExplicitPermissions = permissions.some((p) => {
        if (p.module_id !== m.id) return false;
        return p.can_view || (p as FullModulePermission).can_edit || (p as FullModulePermission).can_delete || (p as FullModulePermission).is_owner;
      });
      if (hasAnyExplicitPermissions) return false;

      // Fall back to role-based access
      const moduleRules = allAccess.filter((a) => a.module_id === m.id);
      // No rules defined → accessible to everyone (legacy default)
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
  }, [modules, allAccess, permissions, userGroupIds, roles, user?.id, isExternal]);

  return (
    <ModulesContext.Provider value={{ modules, accessibleModules, allAccess, allPermissions: fullPermissions, userGroupIds, loading, refresh }}>
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
